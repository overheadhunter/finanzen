import { categoryColor, DEFICIT_COLOR, NEUTRAL_COLOR, nuance, SURPLUS_COLOR } from './colors'
import { t } from './i18n'
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
  /**
   * Vertical alignment of the bar within the node's band. `center` for nodes without opposite-signed descendants to route around; otherwise the lane to the parent
   * goes to the band's top (`top`, lane first) or bottom (`bottom`, lane last), with opposite-signed children on the other side. A centered parent splits its children
   * in halves (upper half `bottom`, lower half `top`), an edge-aligned parent passes its own alignment down.
   */
  align: 'top' | 'bottom' | 'center'
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

const defaultLabels = (): GraphLabels => ({ center: t('graph.center'), surplus: t('graph.surplus'), deficit: t('graph.deficit') })

// zero-valued leaves and empty categories don't show up in the diagram
function isSkipped(node: Category): boolean {
  return node.total === 0 && node.children.length === 0
}

function memo<T extends object, R>(fn: (arg: T) => R): (arg: T) => R {
  const cache = new Map<T, R>()
  return (arg) => {
    if (!cache.has(arg)) cache.set(arg, fn(arg))
    return cache.get(arg)!
  }
}

// how far siblings fan out around their parent's hue (degrees) and how much lighter each level gets
const HUE_SPREAD = 28
const LIGHTNESS_STEP = 0.08

/**
 * Builds the sankey graph for a document: income flows from the left into a central budget node, expenses flow out to the right.
 *
 * Positive totals sit left of their parent (flowing towards it), negative totals right of it (fed by it). A node's subtrees of the opposite sign are laid out between the node and its parent, so the node is pushed as far out as needed and its link to the parent spans the columns in between. A surplus or deficit node balances both sides.
 *
 * Exception: if the node's lane is the outermost one on an edge-aligned parent's bar (see {@link GraphNode.align}), the opposite-signed subtree moves one column towards the parent, so its deepest level shares the parent's column: the subtree sits beside the node's lane, which is vertically clear of the parent's bar there.
 *
 * @param doc the parsed document
 * @param labels names of the synthetic nodes
 * @return nodes and links; empty if the document has no non-zero amounts
 */
export function buildGraph(doc: FinanceDocument, labels: GraphLabels = defaultLabels()): Graph {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  const { income, expenses, balance } = summarize(doc)
  nodes.push({ id: CENTER_ID, name: labels.center, column: 0, amount: Math.max(income, expenses), color: NEUTRAL_COLOR, kind: 'center', align: 'center' })

  const shown = (node: Category) => node.children.filter((c) => !isSkipped(c))
  // same-signed children continue outwards, opposite-signed ones lie between the node and its parent
  const own = (node: Category) => shown(node).filter((c) => c.total >= 0 === node.total >= 0)
  const opposite = (node: Category) => shown(node).filter((c) => c.total >= 0 !== node.total >= 0)

  // a bar leaves the band's center if it has opposite-signed children, or if its only own-side child does (so their lanes stay aligned)
  const edgeAligned = memo((node: Category): boolean => opposite(node).length > 0 || (own(node).length === 1 && edgeAligned(own(node)[0]!)))
  const alignOf = (node: Category, parentAlign: GraphNode['align'], index: number, count: number): GraphNode['align'] => {
    if (!edgeAligned(node)) return 'center'
    if (parentAlign !== 'center') return parentAlign
    return index < (count - 1) / 2 ? 'bottom' : 'top'
  }

  // the exception from the doc comment: the deepest level of the opposite-signed subtree may share the parent's column (`index` is -1 for an opposite-signed child, which never shares)
  const shares = (node: Category, parentAlign: GraphNode['align'], index: number, count: number): boolean => {
    if (index < 0 || opposite(node).length === 0) return false
    return parentAlign === 'top' ? index === count - 1 : parentAlign === 'bottom' ? index === 0 : false
  }

  // columns a node's subtrees need on its left (positive children) and right (negative children), given the node's alignment
  const extentOf = (node: Category, align: GraphNode['align']): { left: number; right: number } => {
    const extent = { left: 0, right: 0 }
    const ownChildren = own(node)
    for (const child of shown(node)) {
      const isOwn = child.total >= 0 === node.total >= 0
      const index = ownChildren.indexOf(child)
      const childAlign = alignOf(child, align, index, ownChildren.length)
      const c = extentOf(child, childAlign)
      const columns = (isOwn && shares(child, align, index, ownChildren.length) ? 0 : 1) + c.left + c.right
      if (child.total >= 0) extent.left = Math.max(extent.left, columns)
      else extent.right = Math.max(extent.right, columns)
    }
    return extent
  }

  const place = (node: Category, parentId: string, parentColumn: number, parentAlign: GraphNode['align'], index: number, count: number, color: string, depth: number) => {
    if (isSkipped(node)) return
    const align = alignOf(node, parentAlign, index, count)
    const extent = extentOf(node, align)
    const gap = parentAlign !== 'center' && shares(node, parentAlign, index, count) ? 0 : 1
    const column = node.total >= 0 ? parentColumn - gap - extent.right : parentColumn + gap + extent.left
    nodes.push({ id: node.path, name: node.name, column, amount: node.total, color, kind: 'category', align })
    if (node.total > 0) links.push({ source: node.path, target: parentId, value: node.total, color, node: node.path })
    else if (node.total < 0) links.push({ source: parentId, target: node.path, value: -node.total, color, node: node.path })
    const ownChildren = own(node)
    const n = node.children.length
    node.children.forEach((child, i) => {
      const hue = n > 1 ? ((i / (n - 1)) - 0.5) * HUE_SPREAD / depth : 0
      // only own-side children count for the halves rule; opposite-signed children inherit the alignment
      const ownIndex = ownChildren.indexOf(child)
      place(child, node.path, column, align, ownIndex, ownIndex === -1 ? 0 : ownChildren.length, nuance(color, LIGHTNESS_STEP * depth, hue), depth + 1)
    })
  }

  // the center is laid out like a node whose own children are all tops, with the halves rule applied per side
  const tops = doc.categories.filter((c) => !isSkipped(c))
  const positiveTops = tops.filter((c) => c.total >= 0)
  const negativeTops = tops.filter((c) => c.total < 0)
  doc.categories.forEach((top, i) => {
    const side = top.total >= 0 ? positiveTops : negativeTops
    place(top, CENTER_ID, 0, 'center', side.indexOf(top), side.length, categoryColor(i), 1)
  })

  if (balance > 0) {
    nodes.push({ id: BALANCE_ID, name: labels.surplus, column: 1, amount: -balance, color: SURPLUS_COLOR, kind: 'balance', align: 'center' })
    links.push({ source: CENTER_ID, target: BALANCE_ID, value: balance, color: SURPLUS_COLOR, node: BALANCE_ID })
  } else if (balance < 0) {
    nodes.push({ id: BALANCE_ID, name: labels.deficit, column: -1, amount: -balance, color: DEFICIT_COLOR, kind: 'balance', align: 'center' })
    links.push({ source: BALANCE_ID, target: CENTER_ID, value: -balance, color: DEFICIT_COLOR, node: BALANCE_ID })
  }

  if (links.length === 0) return { nodes: [], links: [], columnCount: 0 }
  const min = Math.min(...nodes.map((n) => n.column))
  const max = Math.max(...nodes.map((n) => n.column))
  for (const n of nodes) n.column -= min
  return { nodes, links, columnCount: max - min + 1 }
}
