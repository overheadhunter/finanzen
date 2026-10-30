import { describe, expect, it } from 'vitest'
import { EXAMPLES } from './example'
import { categoryAt, summarize } from './model'
import { coerceAmount, formatYamlAmount, normalizeAmounts, parseDocument } from './yamlFormat'

describe('parseDocument', () => {
  it('parses the example into a tree with totals', () => {
    const doc = parseDocument(EXAMPLES.de)
    expect(doc.settings).toEqual({ version: 1, currencySymbol: '€', decimals: 2 })
    expect(doc.categories.map((c) => [c.key, c.name, c.total])).toEqual([
      ['Gehalt', 'Gehalt', 1900],
      ['Misc', 'Weitere Einkünfte', 400],
      ['Wohnen', 'Wohnen', -950],
      ['daily', 'Täglicher Bedarf', -650],
    ])
    const wohnen = doc.categories[2]!
    expect(wohnen.children.map((c) => [c.path, c.amount])).toEqual([
      ['Wohnen › Miete', -850],
      ['Wohnen › Strom', -100],
    ])
    expect(summarize(doc)).toEqual({ income: 2300, expenses: 1600, balance: 700 })
  })

  it('uses displayname and ignores reserved keys', () => {
    const doc = parseDocument('_data:\n  savings:\n    _settings: { displayname: Sparen }\n    _note: ignored\n    etf: -1\n')
    expect(doc.categories[0]!.name).toBe('Sparen')
    expect(doc.categories[0]!.children.map((c) => c.key)).toEqual(['etf'])
  })

  it('takes a category amount from _settings.value only without subcategories', () => {
    const doc = parseDocument('_data:\n  misc:\n    _settings: { value: 400 }\n  mixed:\n    _settings: { value: 10 }\n    a: -4\n')
    expect(doc.categories[0]).toMatchObject({ amount: 400, total: 400, children: [] })
    expect(doc.categories[1]).toMatchObject({ total: -4 })
    expect(doc.categories[1]!.amount).toBeUndefined()
  })

  it('records source ranges and resolves the category at an offset', () => {
    const text = '_data:\n  a:\n    b: 10\n    c:\n      _settings:\n        value: -5\n  d: 1\n'
    const doc = parseDocument(text)
    const slice = (r: { start: number; end: number }) => text.slice(r.start, r.end)
    const [a, d] = doc.categories
    const [b, c] = a!.children
    expect(slice(a!.keyRange)).toBe('a')
    expect(slice(b!.valueRange!)).toBe('10')
    expect(slice(c!.valueRange!)).toBe('-5')
    expect(slice(d!.valueRange!)).toBe('1')
    expect(a!.valueRange).toBeUndefined()
    expect(slice(a!.range)).toContain('value: -5')
    expect(categoryAt(doc, text.indexOf('b: 10'))?.path).toBe('a › b')
    expect(categoryAt(doc, text.indexOf('value: -5'))?.path).toBe('a › c')
    expect(categoryAt(doc, text.indexOf('d: 1'))?.path).toBe('d')
    expect(categoryAt(doc, 0)).toBeUndefined()
  })

  it('autocorrects amounts that YAML does not parse as numbers', () => {
    expect(coerceAmount('1.234,56')).toBe(1234.56)
    expect(coerceAmount('1,234.56')).toBe(1234.56)
    expect(coerceAmount('-1.234,56 €')).toBe(-1234.56)
    expect(coerceAmount('+1,5')).toBe(1.5)
    expect(coerceAmount('-1 000')).toBe(-1000)
    expect(coerceAmount(' - 1 234,5 ')).toBe(-1234.5)
    expect(coerceAmount('EUR 12')).toBe(12)
    expect(coerceAmount('1,000,000')).toBe(1000)
    expect(coerceAmount('€')).toBeUndefined()
    expect(coerceAmount('')).toBeUndefined()
    const doc = parseDocument('_data:\n  a: -1.234,56\n  b:\n    _settings: { value: "2,5" }\n')
    expect(doc.categories.map((c) => c.amount)).toEqual([-1234.56, 2.5])
    expect(() => parseDocument('_data:\n  a: text\n')).toThrow('“a”')
  })

  it('rewrites every amount literal into its canonical form', () => {
    const text = '_data:\n  a: -1.234,56 # rent\n  b:\n    _settings: { value: "2,5" }\n  c: 7\n  d: 2.5\n  e: 1e3\n  f: 3.00\n  g: 4.125\n'
    const normalized = normalizeAmounts(text).text
    expect(normalized).toBe('_data:\n  a: -1234.56 # rent\n  b:\n    _settings: { value: 2.50 }\n  c: 7\n  d: 2.50\n  e: 1000\n  f: 3\n  g: 4.125\n')
    expect(normalizeAmounts(normalized).text).toBe(normalized)
    expect(normalizeAmounts('a: [')).toEqual({ text: 'a: [', cursor: -1 })
  })

  it('skips the cursor line and shifts the cursor by earlier edits', () => {
    const text = '_data:\n  a: 1.234,56\n  b: 2,5\n  c: 3,0\n'
    const cursorInB = text.indexOf('2,5') + 1
    const result = normalizeAmounts(text, cursorInB)
    expect(result.text).toBe('_data:\n  a: 1234.56\n  b: 2,5\n  c: 3\n')
    expect(result.text.slice(result.cursor, result.cursor + 3)).toBe(',5\n')
    const cursorInC = text.indexOf('3,0')
    expect(normalizeAmounts(text, cursorInC).text).toBe('_data:\n  a: 1234.56\n  b: 2.50\n  c: 3,0\n')
  })

  it('formats rewritten literals with at least the configured decimals, except integers', () => {
    expect(formatYamlAmount(3, 2)).toBe('3')
    expect(formatYamlAmount(-3, 2)).toBe('-3')
    expect(formatYamlAmount(2.5, 2)).toBe('2.50')
    expect(formatYamlAmount(-2.5, 3)).toBe('-2.500')
    expect(formatYamlAmount(1234.567, 2)).toBe('1234.567')
    expect(formatYamlAmount(2.5, 0)).toBe('2.5')
    expect(normalizeAmounts('_settings: { currency: { decimals: 3 } }\n_data:\n  a: 1,5\n  b: 2,\n').text).toBe('_settings: { currency: { decimals: 3 } }\n_data:\n  a: 1.500\n  b: 2\n')
  })

  it('falls back to defaults for empty or minimal documents', () => {
    expect(parseDocument('')).toEqual({ settings: { version: 1, currencySymbol: '€', decimals: 2 }, categories: [] })
    expect(parseDocument('_settings:\n  currency:\n    decimals: 0\n').settings.decimals).toBe(0)
    expect(parseDocument('_data:\n  empty:\n')).toMatchObject({ categories: [{ key: 'empty', total: 0, children: [] }] })
  })

  it('rejects broken documents with a path', () => {
    expect(() => parseDocument('a: [')).toThrow('Invalid YAML')
    expect(() => parseDocument('- 1')).toThrow('top level')
    expect(() => parseDocument('_settings:\n  version: 2\n')).toThrow('version 2')
    expect(() => parseDocument('_settings:\n  currency:\n    symbol: 1\n')).toThrow('symbol')
    expect(() => parseDocument('_settings:\n  currency:\n    decimals: 1.5\n')).toThrow('currency.decimals')
    expect(() => parseDocument('_data:\n  a:\n    b: text\n')).toThrow('“a › b”')
    expect(() => parseDocument('_data:\n  a:\n    _settings: { displayname: 1 }\n')).toThrow('displayname')
    expect(() => parseDocument('_data:\n  a:\n    _settings: { value: "x" }\n')).toThrow('_settings.value')
  })
})
