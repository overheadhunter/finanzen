import { describe, expect, it } from 'vitest'
import { buildGraph } from './sankeyGraph'
import { endpoint, layoutGraph } from './sankeyLayout'
import { parseDocument } from './yamlFormat'

const options = { width: 1000, height: 400, marginX: 100, marginY: 10, nodeWidth: 10, nodePadding: 10 }

// three levels on the income side, two on the expense side
const DEEP_YAML = `
_data:
  income:
    work:
      salary: 2000
    stocks:
      dividends: 100
  tax:
    income tax: -500
    foo: -50
  household:
    food: -600
  savings:
    etf: -300
`

describe('layoutGraph', () => {
  it('positions every node within the extent according to its column', () => {
    const graph = buildGraph(parseDocument(DEEP_YAML))
    const layout = layoutGraph(graph, options)!
    expect(layout.lastColumn).toBe(5)
    for (const n of layout.nodes) {
      for (const v of [n.x0, n.x1, n.y0, n.y1]) expect(Number.isFinite(v)).toBe(true)
      expect(n.x0).toBeGreaterThanOrEqual(100)
      expect(n.x1).toBeLessThanOrEqual(900)
      expect(n.y0).toBeGreaterThanOrEqual(10)
      expect(n.y1).toBeLessThanOrEqual(390)
    }
    const xOf = (id: string) => layout.nodes.find((n) => n.id === id)!.x0!
    expect(xOf('income › work › salary')).toBeLessThan(xOf('income › work'))
    expect(xOf('income')).toBeLessThan(xOf('_center'))
    expect(xOf('_center')).toBeLessThan(xOf('tax'))
    expect(xOf('tax')).toBeLessThan(xOf('tax › foo'))
    for (const l of layout.links) {
      expect(Number.isFinite(l.width)).toBe(true)
      expect(endpoint(l.source).x1).toBeLessThan(endpoint(l.target).x0!)
    }
  })

  it('keeps nodes in YAML order within a column', () => {
    const layout = layoutGraph(buildGraph(parseDocument(DEEP_YAML)), options)!
    const yOf = (id: string) => layout.nodes.find((n) => n.id === id)!.y0!
    expect(yOf('tax')).toBeLessThan(yOf('household'))
    expect(yOf('household')).toBeLessThan(yOf('savings'))
  })

  it('returns null without links', () => {
    expect(layoutGraph({ nodes: [], links: [], columnCount: 0 }, options)).toBeNull()
  })
})
