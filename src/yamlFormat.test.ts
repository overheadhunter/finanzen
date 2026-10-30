import { describe, expect, it } from 'vitest'
import { EXAMPLE_YAML } from './example'
import { categoryAt, summarize } from './model'
import { parseDocument } from './yamlFormat'

describe('parseDocument', () => {
  it('parses the example into a tree with totals', () => {
    const doc = parseDocument(EXAMPLE_YAML)
    expect(doc.settings).toEqual({ version: 1, currencySymbol: '€' })
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

  it('falls back to defaults for empty or minimal documents', () => {
    expect(parseDocument('')).toEqual({ settings: { version: 1, currencySymbol: '€' }, categories: [] })
    expect(parseDocument('_data:\n  empty:\n')).toMatchObject({ categories: [{ key: 'empty', total: 0, children: [] }] })
  })

  it('rejects broken documents with a path', () => {
    expect(() => parseDocument('a: [')).toThrow('Ungültiges YAML')
    expect(() => parseDocument('- 1')).toThrow('oberster Ebene')
    expect(() => parseDocument('_settings:\n  version: 2\n')).toThrow('Version 2')
    expect(() => parseDocument('_settings:\n  currency:\n    symbol: 1\n')).toThrow('symbol')
    expect(() => parseDocument('_data:\n  a:\n    b: text\n')).toThrow('„a › b“')
    expect(() => parseDocument('_data:\n  a:\n    _settings: { displayname: 1 }\n')).toThrow('displayname')
    expect(() => parseDocument('_data:\n  a:\n    _settings: { value: "1" }\n')).toThrow('_settings.value')
  })
})
