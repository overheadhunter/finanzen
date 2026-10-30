<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { sankeyLinkHorizontal } from 'd3-sankey'
import { formatAmount } from '../format'
import type { Settings } from '../model'
import type { Graph, GraphLink, GraphNode } from '../sankeyGraph'
import { endpoint, layoutGraph, type LayoutLink, type LayoutNode } from '../sankeyLayout'

const props = defineProps<{
  graph: Graph
  settings: Pick<Settings, 'currencySymbol' | 'decimals'>
  /** Id of the node to emphasize, e.g. the category under the editor's cursor. */
  highlighted?: string | null
}>()
const emit = defineEmits<{ select: [id: string] }>()

// labels sit beside the nodes over the flows, so only a small outer margin is needed
const MARGIN_X = 24
// vertical space reserved for the center label, which sits above its node
const MARGIN_Y = 28
const NODE_WIDTH = 14
const NODE_PADDING = 14
const ROW_HEIGHT = 44
const MIN_HEIGHT = 320

const container = ref<HTMLDivElement>()
const width = ref(960)
const hovered = ref<string | null>(null)

let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(480, entry.contentRect.width)
  })
  if (container.value) observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())

const height = computed(() => {
  const perColumn = new Map<number, number>()
  for (const n of props.graph.nodes) perColumn.set(n.column, (perColumn.get(n.column) ?? 0) + 1)
  return Math.max(MIN_HEIGHT, Math.max(0, ...perColumn.values()) * ROW_HEIGHT + 2 * MARGIN_Y)
})

const layout = computed(() =>
  layoutGraph(props.graph, { width: width.value, height: height.value, marginX: MARGIN_X, marginY: MARGIN_Y, nodeWidth: NODE_WIDTH, nodePadding: NODE_PADDING }),
)

const linkPath = sankeyLinkHorizontal<GraphNode, GraphLink>()

// hovering takes precedence over the editor-driven highlight
const active = computed(() => hovered.value ?? props.highlighted ?? null)
const categoryIds = computed(() => new Set(props.graph.nodes.filter((n) => n.kind === 'category').map((n) => n.id)))

function isCategory(id: string): boolean {
  return categoryIds.value.has(id)
}

function linkOpacity(link: LayoutLink): number {
  if (active.value === null) return 0.45
  return endpoint(link.source).id === active.value || endpoint(link.target).id === active.value ? 0.85 : 0.12
}

// the center label sits above its node; income labels sit right of the node, expense labels left of it
function labelAnchor(n: LayoutNode): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  if (n.kind === 'center') return { x: (n.x0! + n.x1!) / 2, y: n.y0! - 8, anchor: 'middle' }
  const y = (n.y0! + n.y1!) / 2
  if (n.amount < 0) return { x: n.x0! - 6, y, anchor: 'end' }
  return { x: n.x1! + 6, y, anchor: 'start' }
}
</script>

<template>
  <div ref="container" class="w-full">
    <svg v-if="layout" :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height" class="block select-none text-xs">
      <g fill="none">
        <path
          v-for="(link, i) in layout.links"
          :key="i"
          :d="linkPath(link) ?? undefined"
          :style="{ stroke: link.color, strokeOpacity: linkOpacity(link) }"
          :stroke-width="Math.max(1, link.width ?? 1)"
          :class="['transition-opacity duration-150', isCategory(link.node) ? 'cursor-pointer' : '']"
          @mouseenter="hovered = link.node"
          @mouseleave="hovered = null"
          @click="isCategory(link.node) && emit('select', link.node)"
        >
          <title>{{ endpoint(link.source).name }} → {{ endpoint(link.target).name }}: {{ formatAmount(link.value, settings) }}</title>
        </path>
      </g>
      <g
        v-for="node in layout.nodes"
        :key="node.id"
        :class="isCategory(node.id) ? 'cursor-pointer' : ''"
        @mouseenter="hovered = node.id"
        @mouseleave="hovered = null"
        @click="isCategory(node.id) && emit('select', node.id)"
      >
        <rect
          :x="node.x0"
          :y="node.y0"
          :width="node.x1! - node.x0!"
          :height="Math.max(1, node.y1! - node.y0!)"
          :style="{ fill: node.color }"
          :class="node.id === highlighted ? 'stroke-neutral-900 stroke-2' : ''"
          rx="2"
        >
          <title>{{ node.id }}: {{ formatAmount(node.amount, settings) }}</title>
        </rect>
        <text :x="labelAnchor(node).x" :y="labelAnchor(node).y" :text-anchor="labelAnchor(node).anchor" dominant-baseline="middle" class="label">
          <tspan :class="node.id === highlighted ? 'font-bold' : 'font-medium'">{{ node.name }}</tspan>
          <tspan dx="0.4em" class="fill-neutral-500">{{ formatAmount(node.amount, settings) }}</tspan>
        </text>
      </g>
    </svg>
    <p v-else class="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-500">Keine Beträge vorhanden. Trage unter „_data“ Einnahmen (positiv) und Ausgaben (negativ) ein.</p>
  </div>
</template>

<style scoped>
.label {
  fill: #0b0b0b;
}
</style>
