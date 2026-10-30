/** Half-open character offsets `[start, end)` into the YAML source. */
export interface TextRange {
  start: number
  end: number
}

/** A node of the income/expense tree. Leaves carry an `amount`; categories aggregate their children into `total`. */
export interface Category {
  /** YAML key of this node. */
  key: string
  /** Display name: `_settings.displayname` if present, otherwise the key. */
  name: string
  /** Keys from the root to this node, joined for use as a unique id and tooltip. */
  path: string
  /** Signed amount of a leaf or a category's own `_settings.value`; `undefined` for categories without one. */
  amount?: number
  /** Signed sum of `amount` and all leaves below. Positive = income, negative = expense. */
  total: number
  children: Category[]
  /** Source span from the key to the end of the value, including all children. */
  range: TextRange
  /** Source span of the key. */
  keyRange: TextRange
  /** Source span of the amount literal, if this node has one. */
  valueRange?: TextRange
}

export interface Settings {
  version: number
  currencySymbol: string
}

export interface FinanceDocument {
  settings: Settings
  /** Top-level categories in YAML order. */
  categories: Category[]
}

export interface Summary {
  income: number
  /** Expenses as a positive number. */
  expenses: number
  /** `income - expenses`. */
  balance: number
}

export function summarize(doc: FinanceDocument): Summary {
  let income = 0
  let expenses = 0
  for (const c of doc.categories) {
    if (c.total > 0) income += c.total
    else expenses -= c.total
  }
  return { income, expenses, balance: income - expenses }
}

/** All categories of the document in depth-first YAML order. */
export function* allCategories(doc: FinanceDocument): Generator<Category> {
  const walk = function* (nodes: Category[]): Generator<Category> {
    for (const n of nodes) {
      yield n
      yield* walk(n.children)
    }
  }
  yield* walk(doc.categories)
}

/** The category with the given path, or `undefined`. */
export function findCategory(doc: FinanceDocument, path: string): Category | undefined {
  for (const c of allCategories(doc)) if (c.path === path) return c
  return undefined
}

/**
 * The innermost category whose source span contains the offset.
 *
 * @param doc the document
 * @param offset character offset into the YAML source, e.g. the editor's cursor position
 * @return the deepest matching category; among equally deep matches the later one wins
 */
export function categoryAt(doc: FinanceDocument, offset: number): Category | undefined {
  let best: Category | undefined
  const walk = (nodes: Category[]) => {
    for (const n of nodes) {
      if (n.range.start <= offset && offset <= n.range.end) {
        best = n
        walk(n.children)
      }
    }
  }
  walk(doc.categories)
  return best
}
