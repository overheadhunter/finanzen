<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faFileExport, faFileImport, faImage, faLink, faPrint, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import SankeyDiagram from './components/SankeyDiagram.vue'
import YamlEditor from './components/YamlEditor.vue'
import { EXAMPLE_YAML } from './example'
import { formatAmount } from './format'
import { categoryAt, findCategory, summarize } from './model'
import { buildGraph } from './sankeyGraph'
import { useDocumentText } from './store/document'
import { exportPng } from './store/png'
import { decodeShare, encodeShare, sharedFragment, shareUrl } from './store/share'
import { exportYaml, IMPORT_ACCEPT, importYaml } from './store/transfer'
import { DEFAULT_CURRENCY_SYMBOL, DEFAULT_DECIMALS, FILE_EXTENSION, normalizeAmounts, parseDocument } from './yamlFormat'

const text = useDocumentText()
const fileInput = ref<HTMLInputElement>()
const diagram = ref<InstanceType<typeof SankeyDiagram>>()
const importError = ref('')
const notice = ref('')

// keep the last valid document while the user is mid-edit, and show the parse error alongside
const parsed = computed(() => {
  try {
    return { doc: parseDocument(text.value), error: '' }
  } catch (e) {
    return { doc: null, error: e instanceof Error ? e.message : String(e) }
  }
})
const lastValid = ref(parsed.value.doc)
const doc = computed(() => {
  if (parsed.value.doc) lastValid.value = parsed.value.doc
  return lastValid.value
})
const settings = computed(() => doc.value?.settings ?? { currencySymbol: DEFAULT_CURRENCY_SYMBOL, decimals: DEFAULT_DECIMALS })
const summary = computed(() => (doc.value ? summarize(doc.value) : null))
const graph = computed(() => (doc.value ? buildGraph(doc.value) : { nodes: [], links: [], columnCount: 0 }))

// editor → diagram: emphasize the category under the cursor (only while the text parses, since ranges of the last valid document would be stale)
const editor = ref<InstanceType<typeof YamlEditor>>()
const cursor = ref(-1)
const highlighted = computed(() => (parsed.value.doc && cursor.value >= 0 ? (categoryAt(parsed.value.doc, cursor.value)?.path ?? null) : null))

// amount literals like `1.234,56` are rewritten as plain numbers as soon as the cursor leaves their line (or the editor), so the rewrite never interferes with typing
function onCursor(offset: number) {
  cursor.value = offset
  const normalized = normalizeAmounts(text.value, offset)
  if (normalized.text === text.value) return
  text.value = normalized.text
  cursor.value = normalized.cursor
  if (normalized.cursor >= 0) editor.value?.select(normalized.cursor, normalized.cursor)
}

// diagram → editor: select the amount literal (or the key, for categories without one) so typing replaces it
function onSelect(path: string) {
  const category = doc.value && findCategory(doc.value, path)
  if (!category) return
  const range = category.valueRange ?? category.keyRange
  editor.value?.select(range.start, range.end)
}

async function onImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await importFile(file)
}

async function importFile(file: File) {
  importError.value = ''
  try {
    const content = await importYaml(file)
    parseDocument(content) // validate before replacing the editor content
    text.value = normalizeAmounts(content).text
    showNotice(`„${file.name}“ importiert.`)
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Import fehlgeschlagen.'
  }
}

// the whole page accepts dropped files; a counter tracks nested dragenter/dragleave pairs so the overlay doesn't flicker over child elements
const dragDepth = ref(0)
const dragging = computed(() => dragDepth.value > 0)
const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false
function onDragEnter(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  dragDepth.value++
}
function onDragOver(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
function onDragLeave(e: DragEvent) {
  if (!hasFiles(e)) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}
async function onDrop(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  dragDepth.value = 0
  const file = e.dataTransfer?.files[0]
  if (!file) return
  if (!/\.(ya?ml|png)$/i.test(file.name)) {
    importError.value = `„${file.name}“ ist weder eine YAML- noch eine PNG-Datei.`
    return
  }
  await importFile(file)
}
const dragListeners: [keyof DocumentEventMap, (e: DragEvent) => void][] = [
  ['dragenter', onDragEnter],
  ['dragover', onDragOver],
  ['dragleave', onDragLeave],
  ['drop', onDrop],
]
onMounted(() => dragListeners.forEach(([type, listener]) => document.addEventListener(type, listener as EventListener)))
onBeforeUnmount(() => dragListeners.forEach(([type, listener]) => document.removeEventListener(type, listener as EventListener)))

function onExample() {
  if (text.value.trim() === '' || text.value === EXAMPLE_YAML || confirm('Aktuellen Inhalt durch das Beispiel ersetzen?')) text.value = EXAMPLE_YAML
}

async function onExportPng() {
  importError.value = ''
  const svg = diagram.value?.svgElement()
  if (!svg) {
    importError.value = 'Kein Diagramm vorhanden.'
    return
  }
  try {
    await exportPng(svg, text.value)
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'PNG-Export fehlgeschlagen.'
  }
}

// the document travels compressed in the URL fragment, which browsers never send to the server
async function onShare() {
  importError.value = ''
  const url = shareUrl(await encodeShare(text.value))
  try {
    await navigator.clipboard.writeText(url)
    showNotice('Link in die Zwischenablage kopiert.')
  } catch {
    prompt('Link zum Teilen:', url)
  }
}

function onPrint() {
  window.print()
}

function showNotice(message: string) {
  notice.value = message
  setTimeout(() => {
    if (notice.value === message) notice.value = ''
  }, 3000)
}

onMounted(async () => {
  const encoded = sharedFragment(location.hash)
  if (!encoded) return
  history.replaceState(null, '', location.pathname + location.search) // a reload must not re-import
  try {
    const shared = await decodeShare(encoded)
    parseDocument(shared)
    const untouched = text.value.trim() === '' || text.value === EXAMPLE_YAML || text.value === shared
    if (untouched || confirm('Geteilte Daten laden und den aktuellen Inhalt ersetzen?')) text.value = shared
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Der geteilte Link konnte nicht geladen werden.'
  }
})
</script>

<template>
  <div
    v-if="dragging"
    class="pointer-events-none fixed inset-0 z-10 flex items-center justify-center border-4 border-dashed border-sky-500 bg-sky-50/80 text-lg font-medium text-sky-700 print:hidden"
  >
    YAML- oder PNG-Datei hier ablegen
  </div>
  <main class="mx-auto max-w-7xl p-6 print:max-w-none print:p-0">
    <header class="mb-6 flex flex-wrap items-center gap-3 print:hidden">
      <h1 class="text-2xl font-bold">Finanzen</h1>
      <div class="ml-auto flex gap-2">
        <button type="button" class="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100" title="Beispiel laden" @click="onExample">
          <FontAwesomeIcon :icon="faWandMagicSparkles" class="mr-2 size-4" />Beispiel
        </button>
        <button type="button" class="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100" :title="`${FILE_EXTENSION}-Datei oder exportiertes PNG laden`" @click="fileInput?.click()">
          <FontAwesomeIcon :icon="faFileImport" class="mr-2 size-4" />Importieren…
        </button>
        <input ref="fileInput" type="file" :accept="IMPORT_ACCEPT" class="hidden" @change="onImport" />
        <button type="button" class="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100" title="Diagramm als PNG speichern" @click="onExportPng">
          <FontAwesomeIcon :icon="faImage" class="mr-2 size-4" />PNG
        </button>
        <button type="button" class="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100" title="Diagramm drucken (A4 quer)" @click="onPrint">
          <FontAwesomeIcon :icon="faPrint" class="mr-2 size-4" />Drucken
        </button>
        <button type="button" class="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100" title="Link mit den aktuellen Daten kopieren" @click="onShare">
          <FontAwesomeIcon :icon="faLink" class="mr-2 size-4" />Teilen
        </button>
        <button type="button" class="rounded bg-sky-600 px-3 py-2 text-white hover:bg-sky-700" :title="`Als ${FILE_EXTENSION}-Datei speichern`" @click="exportYaml(text)">
          <FontAwesomeIcon :icon="faFileExport" class="mr-2 size-4" />Exportieren
        </button>
      </div>
    </header>

    <p v-if="importError" class="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">{{ importError }}</p>
    <p v-if="notice" class="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 print:hidden">{{ notice }}</p>

    <!-- in print the tiles collapse to a single line of "label value" pairs, so the diagram gets the page -->
    <dl v-if="summary" class="mb-4 grid grid-cols-3 gap-3 text-sm print:mb-2 print:flex print:gap-8">
      <div class="rounded-lg border border-neutral-200 bg-white p-3 print:flex print:items-baseline print:gap-2 print:border-0 print:p-0">
        <dt class="text-neutral-500">Einnahmen</dt>
        <dd class="text-lg font-semibold tabular-nums print:text-sm">{{ formatAmount(summary.income, settings) }}</dd>
      </div>
      <div class="rounded-lg border border-neutral-200 bg-white p-3 print:flex print:items-baseline print:gap-2 print:border-0 print:p-0">
        <dt class="text-neutral-500">Ausgaben</dt>
        <dd class="text-lg font-semibold tabular-nums print:text-sm">{{ formatAmount(summary.expenses, settings) }}</dd>
      </div>
      <div class="rounded-lg border border-neutral-200 bg-white p-3 print:flex print:items-baseline print:gap-2 print:border-0 print:p-0">
        <dt class="text-neutral-500">Saldo</dt>
        <dd class="text-lg font-semibold tabular-nums print:text-sm" :class="summary.balance < 0 ? 'text-red-700' : 'text-green-700'">{{ formatAmount(summary.balance, settings) }}</dd>
      </div>
    </dl>

    <section class="mb-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-4 shadow-sm print:overflow-visible print:break-inside-avoid print:border-0 print:p-0 print:shadow-none">
      <SankeyDiagram ref="diagram" :graph="graph" :settings="settings" :highlighted="highlighted" @select="onSelect" />
    </section>

    <section class="print:hidden">
      <div class="mb-2 flex items-baseline gap-3">
        <h2 class="font-semibold">YAML</h2>
        <p v-if="parsed.error" class="text-sm text-red-700">{{ parsed.error }}</p>
        <p v-else class="text-sm text-neutral-500">Änderungen werden sofort übernommen und lokal gespeichert.</p>
      </div>
      <YamlEditor ref="editor" v-model="text" @cursor="onCursor" />
    </section>
    <p class="mt-6 text-xs text-neutral-400 print:hidden">Alle Daten werden ausschließlich lokal in diesem Browser gespeichert. Zum Übertragen auf ein anderes Gerät die YAML-Datei exportieren und dort importieren.</p>
  </main>
</template>
