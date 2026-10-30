import type { Graph, GraphLink, GraphNode } from './sankeyGraph'

export interface LayoutNode extends GraphNode {
  x0: number
  x1: number
  y0: number
  y1: number
}

export interface LayoutLink extends Omit<GraphLink, 'source' | 'target'> {
  source: LayoutNode
  target: LayoutNode
  /** Vertical center of the lane where it leaves the source. */
  y0: number
  /** Vertical center of the lane where it enters the target. */
  y1: number
  width: number
  /** Horizontal extent of the curved part; outside it the lane runs straight at the height of its band. */
  bend: [number, number]
}

export interface Layout {
  nodes: LayoutNode[]
  links: LayoutLink[]
  lastColumn: number
}

export interface LayoutOptions {
  width: number
  height: number
  marginX: number
  marginY: number
  nodeWidth: number
  /** Vertical gap between sibling bands and between a lane and the subtree below it. */
  nodePadding: number
}

// a node together with the children on either side of it; `row` is the band height in px after measuring
interface Band {
  node: LayoutNode
  /** Link to the parent (into it for positive nodes, out of it for negative ones); absent for the center. */
  parentLink?: LayoutLink
  left: Band[]
  right: Band[]
  /** Bar height in value units: the larger of inflow and outflow. */
  bar: number
  row: number
  /** `true` if the lane to the parent is the last one on the bar, i.e. at the bottom of the band with opposite-signed children above it. */
  laneLast: boolean
}

/**
 * Positions nodes and links of a graph within the given extent.
 *
 * Horizontal positions come from each node's precomputed `column`. Vertically, every node owns a band that is reserved for its whole subtree: same-signed children are stacked beside it, opposite-signed children (which sit between the node and its parent) are stacked beside the lane to the parent, on the side facing away from the parent's bar: the upper half of a centered parent's children put the lane at the bottom of their band, the lower half at the top. Bands of siblings never overlap, and a lane spanning several columns only bends in the gap next to the parent, so lanes never cross other subtrees. The value scale is chosen so the center's band fills the available height.
 *
 * @param graph the graph to lay out
 * @param options extent and spacing
 * @return positioned copies of the graph's nodes and links, or `null` if the graph has no links
 */
export function layoutGraph(graph: Graph, options: LayoutOptions): Layout | null {
  if (graph.links.length === 0) return null
  const { width, height, marginX, marginY, nodeWidth, nodePadding } = options
  const step = (width - 2 * marginX - nodeWidth) / Math.max(1, graph.columnCount - 1)
  const columnX = (column: number) => marginX + column * step
  const nodes: LayoutNode[] = graph.nodes.map((n) => ({ ...n, x0: columnX(n.column), x1: columnX(n.column) + nodeWidth, y0: 0, y1: 0 }))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const links: LayoutLink[] = graph.links.map((l) => {
    const source = byId.get(l.source)!
    const target = byId.get(l.target)!
    // a positive link converges towards its parent on the right, a negative one fans out from its parent on the left
    const bend: [number, number] = l.node === l.source ? [columnX(target.column - 1) + nodeWidth, target.x0] : [source.x1, columnX(source.column + 1)]
    return { ...l, source, target, y0: 0, y1: 0, width: 0, bend }
  })

  const { root, bands } = buildBands(nodes, links)
  const available = height - 2 * marginY
  const ky = solveScale(root, nodePadding, available)
  measure(root, ky, nodePadding)
  place(root, marginY + (available - root.row) / 2, ky, nodePadding, false)
  attachLinks(bands, links, ky)
  return { nodes, links, lastColumn: graph.columnCount - 1 }
}

/**
 * SVG path of a lane as a filled shape: its top and bottom edges run straight at the band height across intermediate columns and bend only across `link.bend`.
 *
 * Adjacent lanes share their edge curves, so they tile exactly no matter how steep the bend (a stroked center line would overlap its neighbours there).
 *
 * @param link a positioned link
 * @return the path data
 */
export function linkPath(link: LayoutLink): string {
  const { source, target, y0, y1, width, bend } = link
  const [from, to] = bend
  const mid = (from + to) / 2
  const half = width / 2
  const top = `M${source.x1},${y0 - half}${from > source.x1 ? `H${from}` : ''}C${mid},${y0 - half} ${mid},${y1 - half} ${to},${y1 - half}${to < target.x0 ? `H${target.x0}` : ''}`
  const bottom = `L${target.x0},${y1 + half}${to < target.x0 ? `H${to}` : ''}C${mid},${y1 + half} ${mid},${y0 + half} ${from},${y0 + half}${from > source.x1 ? `H${source.x1}` : ''}Z`
  return top + bottom
}

/**
 * Number of leaf rows the layout needs on its taller side, for sizing the diagram before laying it out.
 *
 * @param graph the graph
 * @return the larger leaf count of the left and right half (the center's column splits them)
 */
export function leafRows(graph: Graph): number {
  const center = graph.nodes.find((n) => n.kind === 'center')?.column ?? 0
  const parents = new Set(graph.links.map((l) => (l.node === l.source ? l.target : l.source)))
  let left = 0
  let right = 0
  for (const n of graph.nodes) {
    if (parents.has(n.id) || n.kind === 'center') continue
    if (n.column < center) left++
    else right++
  }
  return Math.max(left, right)
}

function buildBands(nodes: LayoutNode[], links: LayoutLink[]): { root: Band; bands: Band[] } {
  const bands = new Map(nodes.map((n) => [n.id, { node: n, left: [], right: [], bar: 0, row: 0, laneLast: false } as Band]))
  const inflow = new Map<string, number>()
  const outflow = new Map<string, number>()
  for (const link of links) {
    outflow.set(link.source.id, (outflow.get(link.source.id) ?? 0) + link.value)
    inflow.set(link.target.id, (inflow.get(link.target.id) ?? 0) + link.value)
    // the link's `node` is the child, the other endpoint its parent
    const child = bands.get(link.node)!
    const parent = bands.get(link.node === link.source.id ? link.target.id : link.source.id)!
    child.parentLink = link
    if (child.node.column < parent.node.column) parent.left.push(child)
    else parent.right.push(child)
  }
  for (const band of bands.values()) band.bar = Math.max(inflow.get(band.node.id) ?? 0, outflow.get(band.node.id) ?? 0)
  const all = [...bands.values()]
  return { root: all.find((b) => b.node.kind === 'center')!, bands: all }
}

// opposite-signed children lie between the node and its parent, i.e. on the parent's side
function sides(band: Band): { own: Band[]; opposite: Band[] } {
  if (!band.parentLink) return { own: [...band.left, ...band.right], opposite: [] }
  const parent = band.parentLink.source.id === band.node.id ? band.parentLink.target : band.parentLink.source
  return parent.column > band.node.column ? { own: band.left, opposite: band.right } : { own: band.right, opposite: band.left }
}

function stackHeight(bands: Band[], padding: number): number {
  return bands.reduce((sum, b) => sum + b.row, 0) + Math.max(0, bands.length - 1) * padding
}

function measure(band: Band, ky: number, padding: number): number {
  for (const child of [...band.left, ...band.right]) measure(child, ky, padding)
  const barHeight = band.bar * ky
  if (!band.parentLink) {
    band.row = Math.max(barHeight, stackHeight(band.left, padding), stackHeight(band.right, padding))
    return band.row
  }
  const { own, opposite } = sides(band)
  const laneHeight = band.parentLink.value * ky
  const belowLane = opposite.length > 0 ? laneHeight + padding + stackHeight(opposite, padding) : 0
  band.row = Math.max(barHeight, stackHeight(own, padding), belowLane)
  return band.row
}

// Bars and same-side stacks are centered in the band unless opposite-signed children must fit beside the parent lane. Then the lane goes to the edge of the band
// that faces the parent's bar (top for "lane first", bottom for "lane last"), the bar and the own-side stack align with that edge, and the opposite stack takes the other side.
// A centered bar splits its children in halves (upper half: lane last, lower half: lane first); an edge-aligned bar passes its own mode down.
function place(band: Band, top: number, ky: number, padding: number, laneLast: boolean) {
  const { own, opposite } = sides(band)
  const mixed = opposite.length > 0
  const barHeight = band.bar * ky
  band.laneLast = laneLast
  const stack = (bands: Band[], start: number, modeOf: (index: number) => boolean) => {
    let cursor = start
    bands.forEach((child, i) => {
      place(child, cursor, ky, padding, modeOf(i))
      cursor += child.row + padding
    })
  }
  const halves = (bands: Band[]) => (i: number) => i < (bands.length - 1) / 2
  if (!band.parentLink) {
    band.node.y0 = top + (band.row - barHeight) / 2
    band.node.y1 = band.node.y0 + barHeight
    stack(band.left, top + (band.row - stackHeight(band.left, padding)) / 2, halves(band.left))
    stack(band.right, top + (band.row - stackHeight(band.right, padding)) / 2, halves(band.right))
    return
  }
  if (!mixed) {
    band.node.y0 = top + (band.row - barHeight) / 2
    band.node.y1 = band.node.y0 + barHeight
    stack(own, top + (band.row - stackHeight(own, padding)) / 2, halves(own))
    return
  }
  const laneHeight = band.parentLink.value * ky
  if (laneLast) {
    band.node.y1 = top + band.row
    band.node.y0 = band.node.y1 - barHeight
    stack(own, top + band.row - stackHeight(own, padding), () => true)
    stack(opposite, top, () => true)
  } else {
    band.node.y0 = top
    band.node.y1 = band.node.y0 + barHeight
    stack(own, top, () => false)
    stack(opposite, top + laneHeight + padding, () => false)
  }
}

// lanes leave a bar on the right and enter on the left, stacked in child order; the parent lane comes first unless the band puts it last
function attachLinks(bands: Band[], links: LayoutLink[], ky: number) {
  const outgoing = new Map<string, LayoutLink[]>()
  const incoming = new Map<string, LayoutLink[]>()
  for (const link of links) {
    link.width = link.value * ky
    outgoing.set(link.source.id, [...(outgoing.get(link.source.id) ?? []), link])
    incoming.set(link.target.id, [...(incoming.get(link.target.id) ?? []), link])
  }
  const ordered = (list: LayoutLink[], band: Band) => {
    const parent = band.parentLink
    if (!parent || !band.laneLast || !list.includes(parent)) return list
    return [...list.filter((l) => l !== parent), parent]
  }
  for (const band of bands) {
    let cursor = band.node.y0
    for (const link of ordered(outgoing.get(band.node.id) ?? [], band)) {
      link.y0 = cursor + link.width / 2
      cursor += link.width
    }
    cursor = band.node.y0
    for (const link of ordered(incoming.get(band.node.id) ?? [], band)) {
      link.y1 = cursor + link.width / 2
      cursor += link.width
    }
  }
}

// the band height grows monotonically with the scale, so bisect for the scale at which the root band fills the available height
function solveScale(root: Band, padding: number, available: number): number {
  let low = 0
  let high = available / Math.max(root.bar, 1e-9)
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2
    if (measure(root, mid, padding) > available) high = mid
    else low = mid
  }
  return low
}
