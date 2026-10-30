<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatAmount } from '../format'
import type { Settings } from '../model'
import type { Graph } from '../sankeyGraph'
import { layoutGraph, leafRows, linkPath, type LayoutLink, type LayoutNode } from '../sankeyLayout'

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

// every leaf gets a row on its side of the diagram, so the band layout has room for bars and padding
const height = computed(() => Math.max(MIN_HEIGHT, leafRows(props.graph) * ROW_HEIGHT + 2 * MARGIN_Y))

const layout = computed(() =>
  layoutGraph(props.graph, { width: width.value, height: height.value, marginX: MARGIN_X, marginY: MARGIN_Y, nodeWidth: NODE_WIDTH, nodePadding: NODE_PADDING }),
)


// hovering takes precedence over the editor-driven highlight
const active = computed(() => hovered.value ?? props.highlighted ?? null)
const categoryIds = computed(() => new Set(props.graph.nodes.filter((n) => n.kind === 'category').map((n) => n.id)))

function isCategory(id: string): boolean {
  return categoryIds.value.has(id)
}

// segments of a spanning lane end at invisible waypoints, so highlighting and tooltips refer to the original link, found via its `node`
const originalLinks = computed(() => new Map(props.graph.links.map((l) => [l.node, l])))
const nodeNames = computed(() => new Map(props.graph.nodes.map((n) => [n.id, n.name])))

function linkOpacity(link: LayoutLink): number {
  if (active.value === null) return 0.45
  const original = originalLinks.value.get(link.node)
  return original?.source === active.value || original?.target === active.value ? 0.85 : 0.12
}

function linkTitle(link: LayoutLink): string {
  const original = originalLinks.value.get(link.node)
  if (!original) return ''
  return `${nodeNames.value.get(original.source)} → ${nodeNames.value.get(original.target)}: ${formatAmount(original.value, props.settings)}`
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
      <g>
        <path
          v-for="(link, i) in layout.links"
          :key="i"
          :d="linkPath(link)"
          :style="{ fill: link.color, fillOpacity: linkOpacity(link) }"
          :class="['transition-opacity duration-150', isCategory(link.node) ? 'cursor-pointer' : '']"
          @mouseenter="hovered = link.node"
          @mouseleave="hovered = null"
          @click="isCategory(link.node) && emit('select', link.node)"
        >
          <title>{{ linkTitle(link) }}</title>
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
