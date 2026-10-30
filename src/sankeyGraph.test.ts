import { describe, expect, it } from 'vitest'
import { BALANCE_ID, buildGraph, CENTER_ID } from './sankeyGraph'
import { parseDocument } from './yamlFormat'

// three levels on the income side, two on the expense side
const DEEP_YAML = `
_data:
  income:
    work:
      salary: 2000
      bonus: 100
    stocks:
      dividends: 100
  tax:
    income tax: -500
    foo: -50
  household:
    food: -600
  savings:
    etf: -300
    holidays: -100
`

function columnsOf(graph: ReturnType<typeof buildGraph>): Record<string, number> {
  return Object.fromEntries(graph.nodes.map((n) => [n.id, n.column]))
}

describe('buildGraph', () => {
  it('places income left of the center and expenses right of it', () => {
    const graph = buildGraph(parseDocument(DEEP_YAML))
    const columns = columnsOf(graph)
    expect(graph.columnCount).toBe(6)
    expect(columns).toMatchObject({ 'income › work › salary': 0, 'income › work': 1, income: 2, [CENTER_ID]: 3, tax: 4, 'tax › foo': 5, [BALANCE_ID]: 4 })
    expect(graph.links).toContainEqual(expect.objectContaining({ source: 'income', target: CENTER_ID, value: 2200, node: 'income' }))
    expect(graph.links).toContainEqual(expect.objectContaining({ source: CENTER_ID, target: 'savings', value: 400, node: 'savings' }))
    expect(graph.links).toContainEqual(expect.objectContaining({ source: CENTER_ID, target: BALANCE_ID, value: 650, node: BALANCE_ID }))
  })

  it('shows a deficit on the left when expenses exceed income', () => {
    const graph = buildGraph(parseDocument('_data:\n  a: 10\n  b: -30\n'))
    expect(columnsOf(graph)).toEqual({ a: 0, [BALANCE_ID]: 0, [CENTER_ID]: 1, b: 2 })
    expect(graph.links).toContainEqual(expect.objectContaining({ source: BALANCE_ID, target: CENTER_ID, value: 20 }))
  })

  it('flows opposite-signed children back towards the parent', () => {
    const graph = buildGraph(parseDocument('_data:\n  tax:\n    income tax: -500\n    refund: 100\n'))
    expect(columnsOf(graph)).toEqual({ [BALANCE_ID]: 0, [CENTER_ID]: 1, 'tax › refund': 2, tax: 3, 'tax › income tax': 4 })
    expect(graph.links).toContainEqual(expect.objectContaining({ source: 'tax › refund', target: 'tax', value: 100 }))
    expect(graph.links).toContainEqual(expect.objectContaining({ source: CENTER_ID, target: 'tax', value: 400 }))
  })

  it('keeps nested negative subtrees of an income category left of the center', () => {
    const yaml = '_data:\n  income:\n    work:\n      salary: 2000\n      commute:\n        fuel: -100\n  rent: -500\n'
    const graph = buildGraph(parseDocument(yaml))
    // work is income's only (hence outermost) own child, so the commute subtree moves up to share income's column with its deepest level
    expect(columnsOf(graph)).toEqual({
      'income › work › salary': 0,
      'income › work': 1,
      'income › work › commute': 2,
      'income › work › commute › fuel': 3,
      income: 3,
      [CENTER_ID]: 4,
      [BALANCE_ID]: 5,
      rent: 5,
    })
    expect(graph.columnCount).toBe(6)
    // the link from work to income spans the column of the commute node
    expect(graph.links).toContainEqual(expect.objectContaining({ source: 'income › work', target: 'income', value: 1900 }))
  })

  it('lets opposite-signed leaves share the grandparent column when the lane is outermost on an edge-aligned bar', () => {
    // Sebi is top-aligned (it has PKV below its lane); Netto is its only own child with leaf deductions, so they move into Sebi's column
    const graph = buildGraph(parseDocument('_data:\n  Sebi:\n    Netto:\n      Abr: 6000\n      bAV: -600\n    PKV: -700\n'))
    expect(columnsOf(graph)).toEqual({ 'Sebi › Netto › Abr': 0, 'Sebi › Netto': 1, 'Sebi › Netto › bAV': 2, Sebi: 2, 'Sebi › PKV': 3, [CENTER_ID]: 4, [BALANCE_ID]: 5 })
    const alignOf = Object.fromEntries(graph.nodes.map((n) => [n.id, n.align]))
    expect(alignOf).toMatchObject({ Sebi: 'top', 'Sebi › Netto': 'top', 'Sebi › Netto › Abr': 'center', [CENTER_ID]: 'center' })
    // a deeper deduction subtree shares the column with its deepest level only; a parent whose bar is centered never shares
    const nested = buildGraph(parseDocument('_data:\n  Sebi:\n    Netto:\n      Abr: 6000\n      bAV:\n        x: -600\n    PKV: -700\n'))
    expect(columnsOf(nested)).toMatchObject({ 'Sebi › Netto › Abr': 0, 'Sebi › Netto': 1, 'Sebi › Netto › bAV': 2, 'Sebi › Netto › bAV › x': 3, Sebi: 3, 'Sebi › PKV': 4 })
    const centered = buildGraph(parseDocument('_data:\n  income:\n    work:\n      salary: 2000\n      commute: -100\n    other: 50\n'))
    expect(columnsOf(centered)).toMatchObject({ 'income › work › salary': 0, 'income › work': 1, 'income › work › commute': 2, 'income › other': 2, income: 3 })
    expect(Object.fromEntries(centered.nodes.map((n) => [n.id, n.align]))).toMatchObject({ income: 'center', 'income › work': 'bottom', 'income › other': 'center' })
  })

  it('aligns a centered parent with its only child when that child is edge-aligned', () => {
    const graph = buildGraph(parseDocument('_data:\n  income:\n    work:\n      salary: 2000\n      commute: -100\n  rent: -500\n'))
    expect(Object.fromEntries(graph.nodes.map((n) => [n.id, n.align]))).toMatchObject({ income: 'top', 'income › work': 'top', rent: 'center' })
    // income inherits the edge alignment, so work shares income's column with its commute leaf
    expect(columnsOf(graph)).toMatchObject({ 'income › work › salary': 0, 'income › work': 1, 'income › work › commute': 2, income: 2, [CENTER_ID]: 3 })
  })

  it('skips zero leaves and returns an empty graph without amounts', () => {
    expect(buildGraph(parseDocument(''))).toEqual({ nodes: [], links: [], columnCount: 0 })
    expect(buildGraph(parseDocument('_data:\n  a:\n    b: 0\n')).nodes).toEqual([])
    expect(buildGraph(parseDocument('_data:\n  a:\n    b: 0\n    c: 1\n')).nodes.map((n) => n.id)).toEqual([CENTER_ID, 'a', 'a › c', BALANCE_ID])
  })

  it('colors each top-level category distinctly and subcategories as nuances', () => {
    const graph = buildGraph(parseDocument(DEEP_YAML))
    const color = (id: string) => graph.nodes.find((n) => n.id === id)!.color
    expect(color('income')).not.toBe(color('tax'))
    expect(color('income › work')).toContain(`from ${color('income')}`)
    expect(color('income › work')).not.toBe(color('income › stocks'))
  })
})
