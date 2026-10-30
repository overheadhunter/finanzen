import { sankey, type SankeyLink, type SankeyNode } from 'd3-sankey'
import type { Graph, GraphLink, GraphNode } from './sankeyGraph'

export type LayoutNode = SankeyNode<GraphNode, GraphLink>
export type LayoutLink = SankeyLink<GraphNode, GraphLink>

export interface Layout {
  nodes: LayoutNode[]
  links: LayoutLink[]
  lastColumn: number
}

export interface LayoutOptions {
  width: number
  height: number
  /** Horizontal space reserved for the labels of the outermost columns. */
  marginX: number
  marginY: number
  nodeWidth: number
  nodePadding: number
}

/**
 * Positions nodes and links of a graph within the given extent.
 *
 * d3-sankey only provides the vertical layout; horizontal positions come from each node's precomputed `column`, because d3 derives its column count from the longest path, which can be shorter than the real column range.
 *
 * @param graph the graph to lay out
 * @param options extent and spacing
 * @return positioned copies of the graph's nodes and links, or `null` if the graph has no links
 */
export function layoutGraph(graph: Graph, options: LayoutOptions): Layout | null {
  const { nodes, links, columnCount } = graph
  if (links.length === 0) return null
  const { width, height, marginX, marginY, nodeWidth, nodePadding } = options
  const generator = sankey<GraphNode, GraphLink>()
    .nodeId((d) => d.id)
    .nodeWidth(nodeWidth)
    .nodePadding(nodePadding)
    .nodeAlign((d) => d.column)
    .nodeSort(null)
    .linkSort(null)
    .extent([
      [marginX, marginY],
      [width - marginX, height - marginY],
    ])
  // d3-sankey mutates its input, so hand it copies
  const result = generator({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) })
  const step = (width - 2 * marginX - nodeWidth) / Math.max(1, columnCount - 1)
  for (const n of result.nodes) {
    n.x0 = marginX + n.column * step
    n.x1 = n.x0 + nodeWidth
  }
  return { ...result, lastColumn: columnCount - 1 }
}

/** The node at a link's end; d3-sankey replaces the id strings with node objects during layout. */
export function endpoint(n: LayoutLink['source']): LayoutNode {
  return n as LayoutNode
}
