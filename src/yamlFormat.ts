import { isMap, isNode, isScalar, parseDocument as parseYaml, type Document, type Node, type Pair, type YAMLMap } from 'yaml'
import { allCategories, type Category, type FinanceDocument, type Settings, type TextRange } from './model'

export const SUPPORTED_VERSION = 1
export const DEFAULT_CURRENCY_SYMBOL = '€'
export const DEFAULT_DECIMALS = 2
export const FILE_EXTENSION = '.yaml'
/** Separator between the keys of a nested path, e.g. `income › work › salary`. */
export const PATH_SEPARATOR = ' › '

/**
 * Parses and validates a finance YAML document.
 *
 * @param text YAML source
 * @return the parsed tree, including the text ranges of every category
 * @throws Error with a user-facing German message if the text is not a valid document
 */
export function parseDocument(text: string): FinanceDocument {
  const doc = parseYaml(text)
  if (doc.errors.length > 0) throw new Error(`Ungültiges YAML: ${doc.errors[0]!.message}`)
  const root = doc.contents
  if (root == null) return { settings: defaultSettings(), categories: [] }
  if (!isMap(root)) throw new Error('Die Datei muss auf oberster Ebene eine Map mit „_settings“ und „_data“ sein.')
  const settings = parseSettings(toJs(doc, findPair(root, '_settings')?.value))
  const data = findPair(root, '_data')?.value
  if (data == null || (isScalar(data) && data.value == null)) return { settings, categories: [] }
  if (!isMap(data)) throw new Error('„_data“ muss eine Map aus Kategorien sein.')
  const categories = categoryPairs(data).map((pair) => parseCategory(doc, pair, keyOf(pair)))
  return { settings, categories }
}

function defaultSettings(): Settings {
  return { version: SUPPORTED_VERSION, currencySymbol: DEFAULT_CURRENCY_SYMBOL, decimals: DEFAULT_DECIMALS }
}

function parseSettings(raw: unknown): Settings {
  const settings = defaultSettings()
  if (raw == null) return settings
  if (!isRecord(raw)) throw new Error('„_settings“ muss eine Map sein.')
  if (raw.version != null) {
    if (raw.version !== SUPPORTED_VERSION) throw new Error(`Nicht unterstützte Version ${String(raw.version)} (erwartet: ${SUPPORTED_VERSION}).`)
    settings.version = raw.version
  }
  if (raw.currency != null) {
    if (!isRecord(raw.currency)) throw new Error('„_settings.currency“ muss eine Map sein.')
    if (raw.currency.symbol != null) {
      if (typeof raw.currency.symbol !== 'string') throw new Error('„_settings.currency.symbol“ muss ein Text sein.')
      settings.currencySymbol = raw.currency.symbol
    }
    const decimals = raw.currency.decimals
    if (decimals != null) {
      if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 20) throw new Error('„_settings.currency.decimals“ muss eine ganze Zahl zwischen 0 und 20 sein.')
      settings.decimals = decimals
    }
  }
  return settings
}

function parseCategory(doc: Document, pair: Pair<unknown, unknown>, path: string): Category {
  const key = keyOf(pair)
  const value = isNode(pair.value) ? pair.value : null
  const base = { key, name: key, path, range: rangeOf(pair), keyRange: isNode(pair.key) ? scalarRange(pair.key) : rangeOf(pair) }
  if (value == null || (isScalar(value) && value.value == null)) return { ...base, total: 0, children: [] }
  if (isScalar(value)) {
    const amount = toAmount(value.value)
    if (amount === undefined) throw new Error(`„${path}“ muss ein endlicher Betrag sein.`)
    return { ...base, amount, total: amount, children: [], valueRange: scalarRange(value) }
  }
  if (!isMap(value)) throw new Error(`„${path}“ muss ein Betrag oder eine Map aus Unterkategorien sein.`)
  const settingsPair = findPair(value, '_settings')
  const { name, amount } = parseCategorySettings(toJs(doc, settingsPair?.value), path)
  const children = categoryPairs(value).map((child) => parseCategory(doc, child, path + PATH_SEPARATOR + keyOf(child)))
  if (children.length > 0) return { ...base, name: name ?? key, total: children.reduce((sum, c) => sum + c.total, 0), children }
  if (amount === undefined) return { ...base, name: name ?? key, total: 0, children }
  const valueNode = isMap(settingsPair?.value) ? findPair(settingsPair.value, 'value')?.value : undefined
  if (!isScalar(valueNode)) return { ...base, name: name ?? key, amount, total: amount, children }
  return { ...base, name: name ?? key, amount, total: amount, children, valueRange: scalarRange(valueNode) }
}

/**
 * Rewrites every amount literal into its canonical form (see {@link formatYamlAmount}): autocorrected literals like `1.234,56` become `1234.56`, and valid numbers are padded to the configured decimals, e.g. `2.5` → `2.50`.
 *
 * Literals on the line that contains the cursor are left alone, so a number still being typed is not rewritten underneath the cursor.
 *
 * @param text YAML source
 * @param cursor caret offset into `text`, or a negative value if the editor is not focused
 * @return the corrected source (unchanged if nothing needs correcting or the document is invalid) and the caret offset shifted by the edits before it
 */
export function normalizeAmounts(text: string, cursor = -1): { text: string; cursor: number } {
  let doc: FinanceDocument
  try {
    doc = parseDocument(text)
  } catch {
    return { text, cursor }
  }
  const lineStart = cursor < 0 ? -1 : text.lastIndexOf('\n', cursor - 1) + 1
  const lineEnd = cursor < 0 ? -1 : (text.indexOf('\n', cursor) + 1 || text.length + 1)
  const corrections = [...allCategories(doc)]
    .filter((c) => c.valueRange && c.amount !== undefined)
    .filter((c) => c.valueRange!.start < lineStart || c.valueRange!.start >= lineEnd)
    .map((c) => ({ ...c.valueRange!, replacement: formatYamlAmount(c.amount!, doc.settings.decimals) }))
    .filter((c) => text.slice(c.start, c.end) !== c.replacement)
    .sort((a, b) => b.start - a.start)
  let result = text
  let shifted = cursor
  for (const { start, end, replacement } of corrections) {
    result = result.slice(0, start) + replacement + result.slice(end)
    if (end <= cursor) shifted += replacement.length - (end - start)
  }
  return { text: result, cursor: shifted }
}

/**
 * Formats an amount as a YAML number literal: integers without fraction digits, everything else with at least `decimals` fraction digits (more if the value is more precise).
 *
 * @param amount the amount
 * @param decimals minimum fraction digits for non-integers
 * @return the literal, e.g. `3`, `2.50` or `1234.567` for `decimals = 2`
 */
export function formatYamlAmount(amount: number, decimals: number): string {
  if (Number.isInteger(amount)) return String(amount)
  const plain = String(amount)
  const fraction = plain.split('.')[1]?.length ?? 0
  return fraction < decimals && !plain.includes('e') ? amount.toFixed(decimals) : plain
}

// `_settings.value` carries the amount of a category without subcategories; with subcategories it is ignored
function parseCategorySettings(raw: unknown, path: string): { name?: string; amount?: number } {
  if (raw == null) return {}
  if (!isRecord(raw)) throw new Error(`„${path}“: „_settings“ muss eine Map sein.`)
  const result: { name?: string; amount?: number } = {}
  if (raw.displayname != null) {
    if (typeof raw.displayname !== 'string') throw new Error(`„${path}“: „_settings.displayname“ muss ein Text sein.`)
    result.name = raw.displayname
  }
  if (raw.value != null) {
    const amount = toAmount(raw.value)
    if (amount === undefined) throw new Error(`„${path}“: „_settings.value“ muss ein endlicher Betrag sein.`)
    result.amount = amount
  }
  return result
}

// numbers pass through; strings (e.g. `1.234,56`, which YAML does not parse as a number) are autocorrected
function toAmount(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw === 'string') return coerceAmount(raw)
  return undefined
}

/**
 * Interprets a non-YAML number literal as an amount, tolerating locale-specific separators.
 *
 * Whitespace is removed, non-digit characters are trimmed from both ends (a leading sign is kept), all remaining non-digit characters except the last one are dropped, and the last one is treated as the decimal separator. So `1.234,56` and `1,234.56` both become 1234.56, `-1.234,56 €` becomes -1234.56 and `-1 000` becomes -1000.
 *
 * @param text the literal
 * @return the amount, or `undefined` if the text contains no digits
 */
export function coerceAmount(text: string): number | undefined {
  const compact = text.replace(/\s+/g, '')
  const sign = compact.startsWith('-') ? -1 : 1
  const trimmed = compact.replace(/^\D+/, '').replace(/\D+$/, '')
  if (trimmed === '') return undefined
  const separator = trimmed.search(/\D\d*$/)
  const digits = separator === -1 ? trimmed : `${trimmed.slice(0, separator).replace(/\D/g, '')}.${trimmed.slice(separator + 1)}`
  return sign * Number(digits)
}

// keys starting with `_` are reserved for metadata and never represent categories
function categoryPairs(map: YAMLMap): Pair[] {
  return map.items.filter((pair) => !keyOf(pair).startsWith('_'))
}

function findPair(map: YAMLMap, key: string): Pair | undefined {
  return map.items.find((pair) => keyOf(pair) === key)
}

function keyOf(pair: Pair): string {
  return isScalar(pair.key) ? String(pair.key.value) : String(pair.key)
}

function toJs(doc: Document, node: unknown): unknown {
  return isNode(node) ? node.toJS(doc) : undefined
}

// span from the key to the end of the value, so the deepest category containing a cursor offset can be found
function rangeOf(pair: Pair): TextRange {
  const key = (isNode(pair.key) && pair.key.range) || [0, 0, 0]
  const value = (isNode(pair.value) && pair.value.range) || key
  return { start: key[0], end: Math.max(key[2], value[2]) }
}

// the scalar's own text, without trailing whitespace or comments
function scalarRange(node: Node): TextRange {
  const range = node.range ?? [0, 0, 0]
  return { start: range[0], end: range[1] }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
