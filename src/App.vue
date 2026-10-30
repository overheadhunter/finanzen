<script setup lang="ts">
import { computed, ref } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faFileExport, faFileImport, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import SankeyDiagram from './components/SankeyDiagram.vue'
import YamlEditor from './components/YamlEditor.vue'
import { EXAMPLE_YAML } from './example'
import { formatAmount } from './format'
import { categoryAt, findCategory, summarize } from './model'
import { buildGraph } from './sankeyGraph'
import { useDocumentText } from './store/document'
import { exportYaml, importYaml } from './store/transfer'
import { DEFAULT_CURRENCY_SYMBOL, DEFAULT_DECIMALS, FILE_EXTENSION, normalizeAmounts, parseDocument } from './yamlFormat'

const text = useDocumentText()
const fileInput = ref<HTMLInputElement>()
const importError = ref('')

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
  if (!file) return
  importError.value = ''
  try {
    const content = await importYaml(file)
    parseDocument(content) // validate before replacing the editor content
    text.value = normalizeAmounts(content).text
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Import fehlgeschlagen.'
  }
}

function onExample() {
  if (text.value.trim() === '' || text.value === EXAMPLE_YAML || confirm('Aktuellen Inhalt durch das Beispiel ersetzen?')) text.value = EXAMPLE_YAML
}
</script>

<template>
  <main class="mx-auto max-w-7xl p-6">
    <header class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-bold">Finanzen</h1>
      <div class="ml-auto flex gap-2">
        <button type="button" class="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100" title="Beispiel laden" @click="onExample">
          <FontAwesomeIcon :icon="faWandMagicSparkles" class="mr-2 size-4" />Beispiel
        </button>
        <button type="button" class="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100" :title="`${FILE_EXTENSION}-Datei laden`" @click="fileInput?.click()">
          <FontAwesomeIcon :icon="faFileImport" class="mr-2 size-4" />Importieren…
        </button>
        <input ref="fileInput" type="file" :accept="`${FILE_EXTENSION},.yml,application/yaml,text/yaml`" class="hidden" @change="onImport" />
        <button type="button" class="rounded bg-sky-600 px-3 py-2 text-white hover:bg-sky-700" :title="`Als ${FILE_EXTENSION}-Datei speichern`" @click="exportYaml(text)">
          <FontAwesomeIcon :icon="faFileExport" class="mr-2 size-4" />Exportieren
        </button>
      </div>
    </header>

    <p v-if="importError" class="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ importError }}</p>

    <dl v-if="summary" class="mb-4 grid grid-cols-3 gap-3 text-sm">
      <div class="rounded-lg border border-neutral-200 bg-white p-3">
        <dt class="text-neutral-500">Einnahmen</dt>
        <dd class="text-lg font-semibold tabular-nums">{{ formatAmount(summary.income, settings) }}</dd>
      </div>
      <div class="rounded-lg border border-neutral-200 bg-white p-3">
        <dt class="text-neutral-500">Ausgaben</dt>
        <dd class="text-lg font-semibold tabular-nums">{{ formatAmount(summary.expenses, settings) }}</dd>
      </div>
      <div class="rounded-lg border border-neutral-200 bg-white p-3">
        <dt class="text-neutral-500">Saldo</dt>
        <dd class="text-lg font-semibold tabular-nums" :class="summary.balance < 0 ? 'text-red-700' : 'text-green-700'">{{ formatAmount(summary.balance, settings) }}</dd>
      </div>
    </dl>

    <section class="mb-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <SankeyDiagram :graph="graph" :settings="settings" :highlighted="highlighted" @select="onSelect" />
    </section>

    <section>
      <div class="mb-2 flex items-baseline gap-3">
        <h2 class="font-semibold">YAML</h2>
        <p v-if="parsed.error" class="text-sm text-red-700">{{ parsed.error }}</p>
        <p v-else class="text-sm text-neutral-500">Änderungen werden sofort übernommen und lokal gespeichert.</p>
      </div>
      <YamlEditor ref="editor" v-model="text" @cursor="onCursor" />
    </section>
    <p class="mt-6 text-xs text-neutral-400">Alle Daten werden ausschließlich lokal in diesem Browser gespeichert. Zum Übertragen auf ein anderes Gerät die YAML-Datei exportieren und dort importieren.</p>
  </main>
</template>
