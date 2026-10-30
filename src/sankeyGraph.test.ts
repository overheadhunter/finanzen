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
    expect(columnsOf(graph)).toEqual({ [BALANCE_ID]: 0, [CENTER_ID]: 1, 'tax › refund': 1, tax: 2, 'tax › income tax': 3 })
    expect(graph.links).toContainEqual(expect.objectContaining({ source: 'tax › refund', target: 'tax', value: 100 }))
    expect(graph.links).toContainEqual(expect.objectContaining({ source: CENTER_ID, target: 'tax', value: 400 }))
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
