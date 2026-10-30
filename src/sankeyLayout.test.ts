import { describe, expect, it } from 'vitest'
import { buildGraph } from './sankeyGraph'
import { layoutGraph, leafRows, linkPath } from './sankeyLayout'
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
      expect(l.source.x1).toBeLessThan(l.target.x0)
    }
  })

  it('keeps nodes in YAML order within a column', () => {
    const layout = layoutGraph(buildGraph(parseDocument(DEEP_YAML)), options)!
    const yOf = (id: string) => layout.nodes.find((n) => n.id === id)!.y0!
    expect(yOf('tax')).toBeLessThan(yOf('household'))
    expect(yOf('household')).toBeLessThan(yOf('savings'))
  })

  it('fills the available height and stacks lanes without gaps on a bar', () => {
    const layout = layoutGraph(buildGraph(parseDocument(DEEP_YAML)), options)!
    const node = (id: string) => layout.nodes.find((n) => n.id === id)!
    const center = node('_center')
    // the center bar is the tallest element: 2100 of income, centered in the 380px of available height
    expect(center.y1! - center.y0!).toBeGreaterThan(300)
    expect(center.y0! + center.y1!).toBeCloseTo(400, 0)
    // lanes into the center cover its bar exactly, in YAML order
    const incoming = layout.links.filter((l) => l.target.id === '_center')
    expect(incoming.map((l) => l.source.id)).toEqual(['income'])
    expect(incoming[0]!.width).toBeCloseTo(center.y1! - center.y0!, 6)
    const outgoing = layout.links.filter((l) => l.source.id === '_center')
    expect(outgoing.map((l) => l.target.id)).toEqual(['tax', 'household', 'savings', '_balance'])
    const covered = outgoing.reduce((sum, l) => sum + l.width!, 0)
    expect(covered).toBeCloseTo(center.y1! - center.y0!, 6)
  })

  it('keeps a lane spanning several columns clear of the subtree below it', () => {
    const yaml = '_data:\n  income:\n    work:\n      salary: 2000\n      commute:\n        fuel: -100\n  rent: -500\n'
    const graph = buildGraph(parseDocument(yaml))
    const layout = layoutGraph(graph, options)!
    const node = (id: string) => layout.nodes.find((n) => n.id === id)!
    expect(node('income › work').x1).toBeLessThan(node('income › work › commute').x0!)
    // the deepest level of the commute subtree shares income's column, vertically clear of income's bar
    expect(node('income › work › commute › fuel').x0).toBe(node('income').x0)
    expect(node('income › work › commute › fuel').y0).toBeGreaterThanOrEqual(node('income').y1 + options.nodePadding - 1e-6)
    // the work → income lane leaves work at the top of its bar, runs straight above the commute subtree and only bends after the commute column
    const lane = layout.links.find((l) => l.node === 'income › work')!
    const laneBottom = lane.y0 + lane.width / 2
    for (const id of ['income › work › commute', 'income › work › commute › fuel']) {
      expect(node(id).y0).toBeGreaterThanOrEqual(laneBottom + options.nodePadding - 1e-6)
    }
    expect(lane.bend[0]).toBeGreaterThanOrEqual(node('income › work › commute').x1)
    expect(lane.bend[1]).toBe(node('income').x0)
    expect(linkPath(lane)).toMatch(/^M[\d.]+,[\d.]+H[\d.]+C/)
    // a negative lane fans out right after its parent and then runs straight
    const fuel = layout.links.find((l) => l.node === 'income › work › commute › fuel')!
    expect(fuel.bend).toEqual([node('income › work › commute').x1, node('income › work › commute › fuel').x0])
    expect(linkPath(fuel)).not.toContain('H')
    // the scale is not squeezed: salary alone carries 2000 of the 2100 total and spans most of the height
    expect(node('income › work › salary').y1! - node('income › work › salary').y0!).toBeGreaterThan(250)
  })

  it('puts the parent lane last for the upper half of a centered stack and first for the lower half', () => {
    const yaml = '_data:\n  A:\n    Netto: 2500\n    Handy: -10\n  B:\n    Netto: 6000\n    PKV: -700\n  Wohnen: -1500\n'
    const layout = layoutGraph(buildGraph(parseDocument(yaml)), options)!
    const node = (id: string) => layout.nodes.find((n) => n.id === id)!
    const lane = (id: string) => layout.links.find((l) => l.node === id)!
    // A (upper half): the negative child sits above the bar, the lane leaves at the bottom of the bar
    expect(node('A › Handy').y1).toBeLessThan(node('A').y0)
    expect(lane('A').y0 + lane('A').width / 2).toBeCloseTo(node('A').y1, 6)
    expect(lane('A › Handy').y0).toBeLessThan(lane('A').y0)
    // B (lower half): the lane leaves at the top of the bar, the negative child sits below it
    expect(lane('B').y0 - lane('B').width / 2).toBeCloseTo(node('B').y0, 6)
    expect(node('B › PKV').y0).toBeGreaterThan(lane('B').y0 + lane('B').width / 2)
    // both lanes stay ordered on the center bar
    expect(lane('A').y1).toBeLessThan(lane('B').y1)
  })

  it('reserves disjoint bands for sibling subtrees', () => {
    const yaml = '_data:\n  a:\n    x: 10\n    y:\n      z: -5\n  b:\n    u: 10\n    v: 10\n  c: -20\n'
    const layout = layoutGraph(buildGraph(parseDocument(yaml)), options)!
    const node = (id: string) => layout.nodes.find((n) => n.id === id)!
    const bottomOfA = Math.max(...['a', 'a › x', 'a › y', 'a › y › z'].map((id) => node(id).y1!))
    const topOfB = Math.min(...['b', 'b › u', 'b › v'].map((id) => node(id).y0!))
    expect(topOfB).toBeGreaterThanOrEqual(bottomOfA + options.nodePadding - 1e-6)
  })

  it('counts leaf rows per side', () => {
    // left: salary, dividends; right: income tax, foo, food, etf and the surplus node
    expect(leafRows(buildGraph(parseDocument(DEEP_YAML)))).toBe(5)
  })

  it('returns null without links', () => {
    expect(layoutGraph({ nodes: [], links: [], columnCount: 0 }, options)).toBeNull()
  })
})
