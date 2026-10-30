import { isMap, isNode, isScalar, parseDocument as parseYaml, type Document, type Node, type Pair, type YAMLMap } from 'yaml'
import type { Category, FinanceDocument, Settings, TextRange } from './model'

export const SUPPORTED_VERSION = 1
export const DEFAULT_CURRENCY_SYMBOL = '€'
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
  return { version: SUPPORTED_VERSION, currencySymbol: DEFAULT_CURRENCY_SYMBOL }
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
  }
  return settings
}

function parseCategory(doc: Document, pair: Pair<unknown, unknown>, path: string): Category {
  const key = keyOf(pair)
  const value = isNode(pair.value) ? pair.value : null
  const base = { key, name: key, path, range: rangeOf(pair), keyRange: isNode(pair.key) ? scalarRange(pair.key) : rangeOf(pair) }
  if (value == null || (isScalar(value) && value.value == null)) return { ...base, total: 0, children: [] }
  if (isScalar(value)) {
    if (typeof value.value !== 'number' || !Number.isFinite(value.value)) throw new Error(`„${path}“ muss ein endlicher Betrag sein.`)
    return { ...base, amount: value.value, total: value.value, children: [], valueRange: scalarRange(value) }
  }
  if (!isMap(value)) throw new Error(`„${path}“ muss ein Betrag oder eine Map aus Unterkategorien sein.`)
  const settingsPair = findPair(value, '_settings')
  const { name, amount } = parseCategorySettings(toJs(doc, settingsPair?.value), path)
  const children = categoryPairs(value).map((child) => parseCategory(doc, child, path + PATH_SEPARATOR + keyOf(child)))
  if (children.length > 0) return { ...base, name: name ?? key, total: children.reduce((sum, c) => sum + c.total, 0), children }
  if (amount === undefined) return { ...base, name: name ?? key, total: 0, children }
  const valueNode = isMap(settingsPair?.value) ? findPair(settingsPair.value, 'value')?.value : undefined
  return { ...base, name: name ?? key, amount, total: amount, children, valueRange: isNode(valueNode) ? scalarRange(valueNode) : undefined }
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
    if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) throw new Error(`„${path}“: „_settings.value“ muss ein endlicher Betrag sein.`)
    result.amount = raw.value
  }
  return result
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
