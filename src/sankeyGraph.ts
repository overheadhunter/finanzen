import { categoryColor, DEFICIT_COLOR, NEUTRAL_COLOR, nuance, SURPLUS_COLOR } from './colors'
import { summarize, type Category, type FinanceDocument } from './model'

export const CENTER_ID = '_center'
export const BALANCE_ID = '_balance'

export interface GraphNode {
  id: string
  name: string
  /** Zero-based column from left to right. */
  column: number
  /** Signed amount shown next to the label. */
  amount: number
  color: string
  kind: 'category' | 'center' | 'balance'
}

export interface GraphLink {
  source: string
  target: string
  value: number
  color: string
  /** Id of the node this flow belongs to: the child endpoint (or the balance node), never the parent. */
  node: string
}

export interface Graph {
  nodes: GraphNode[]
  links: GraphLink[]
  columnCount: number
}

export interface GraphLabels {
  center: string
  surplus: string
  deficit: string
}

const DEFAULT_LABELS: GraphLabels = { center: 'Budget', surplus: 'Überschuss', deficit: 'Defizit' }

// zero-valued leaves and empty categories don't show up in the diagram
function isSkipped(node: Category): boolean {
  return node.total === 0 && node.children.length === 0
}

// how far siblings fan out around their parent's hue (degrees) and how much lighter each level gets
const HUE_SPREAD = 28
const LIGHTNESS_STEP = 0.08

/**
 * Builds the sankey graph for a document: income flows from the left into a central budget node, expenses flow out to the right.
 *
 * Positive totals sit left of their parent (flowing towards it), negative totals right of it (fed by it). A node's subtrees of the opposite sign are laid out between the node and its parent, so the node is pushed as far out as needed and its link to the parent spans the columns in between. A surplus or deficit node balances both sides.
 *
 * @param doc the parsed document
 * @param labels names of the synthetic nodes
 * @return nodes and links; empty if the document has no non-zero amounts
 */
export function buildGraph(doc: FinanceDocument, labels: GraphLabels = DEFAULT_LABELS): Graph {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  const { income, expenses, balance } = summarize(doc)
  nodes.push({ id: CENTER_ID, name: labels.center, column: 0, amount: Math.max(income, expenses), color: NEUTRAL_COLOR, kind: 'center' })

  // columns a node's subtrees need on its left (positive children) and right (negative children)
  const extents = new Map<Category, { left: number; right: number }>()
  const extentOf = (node: Category): { left: number; right: number } => {
    let extent = extents.get(node)
    if (extent) return extent
    extent = { left: 0, right: 0 }
    for (const child of node.children) {
      if (isSkipped(child)) continue
      const c = extentOf(child)
      if (child.total >= 0) extent.left = Math.max(extent.left, 1 + c.left + c.right)
      else extent.right = Math.max(extent.right, 1 + c.left + c.right)
    }
    extents.set(node, extent)
    return extent
  }

  const place = (node: Category, parentId: string, parentColumn: number, color: string, depth: number) => {
    if (isSkipped(node)) return
    const extent = extentOf(node)
    const column = node.total >= 0 ? parentColumn - 1 - extent.right : parentColumn + 1 + extent.left
    nodes.push({ id: node.path, name: node.name, column, amount: node.total, color, kind: 'category' })
    if (node.total > 0) links.push({ source: node.path, target: parentId, value: node.total, color, node: node.path })
    else if (node.total < 0) links.push({ source: parentId, target: node.path, value: -node.total, color, node: node.path })
    placeChildren(node, column, color, depth)
  }
  const placeChildren = (parent: Category, column: number, color: string, depth: number) => {
    const n = parent.children.length
    parent.children.forEach((child, i) => {
      const hue = n > 1 ? ((i / (n - 1)) - 0.5) * HUE_SPREAD / depth : 0
      place(child, parent.path, column, nuance(color, LIGHTNESS_STEP * depth, hue), depth + 1)
    })
  }

  doc.categories.forEach((top, i) => place(top, CENTER_ID, 0, categoryColor(i), 1))

  if (balance > 0) {
    nodes.push({ id: BALANCE_ID, name: labels.surplus, column: 1, amount: -balance, color: SURPLUS_COLOR, kind: 'balance' })
    links.push({ source: CENTER_ID, target: BALANCE_ID, value: balance, color: SURPLUS_COLOR, node: BALANCE_ID })
  } else if (balance < 0) {
    nodes.push({ id: BALANCE_ID, name: labels.deficit, column: -1, amount: -balance, color: DEFICIT_COLOR, kind: 'balance' })
    links.push({ source: BALANCE_ID, target: CENTER_ID, value: -balance, color: DEFICIT_COLOR, node: BALANCE_ID })
  }

  if (links.length === 0) return { nodes: [], links: [], columnCount: 0 }
  const min = Math.min(...nodes.map((n) => n.column))
  const max = Math.max(...nodes.map((n) => n.column))
  for (const n of nodes) n.column -= min
  return { nodes, links, columnCount: max - min + 1 }
}
