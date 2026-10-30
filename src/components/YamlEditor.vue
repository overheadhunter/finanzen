<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { INDENT, shiftIndent } from '../indent'

const model = defineModel<string>({ required: true })
// `cursor` reports the caret offset; -1 means the editor lost focus
const emit = defineEmits<{ cursor: [offset: number] }>()

const textarea = ref<HTMLTextAreaElement>()

function emitCursor() {
  if (textarea.value) emit('cursor', textarea.value.selectionStart)
}

// Tab indents instead of moving focus: a plain caret inserts spaces, a multi-line selection (or Shift+Tab) shifts whole lines
function onTab(e: KeyboardEvent) {
  const el = e.target as HTMLTextAreaElement
  const { selectionStart, selectionEnd } = el
  const multiLine = el.value.slice(selectionStart, selectionEnd).includes('\n')
  if (e.shiftKey || multiLine) {
    const edit = shiftIndent(el.value, selectionStart, selectionEnd, e.shiftKey ? -1 : 1)
    el.setRangeText(edit.replacement, edit.blockStart, edit.blockEnd)
    el.setSelectionRange(edit.start, edit.end)
  } else {
    el.setRangeText(INDENT, selectionStart, selectionEnd, 'end')
  }
  model.value = el.value
}

/** Focuses the editor, selects the given span and scrolls it into view. */
async function select(start: number, end: number) {
  const el = textarea.value
  if (!el) return
  await nextTick()
  el.focus()
  el.setSelectionRange(start, end)
  // textareas don't scroll to a programmatic selection, so estimate the line's position from the line height
  const line = el.value.slice(0, start).split('\n').length - 1
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20
  const top = line * lineHeight
  if (top < el.scrollTop || top > el.scrollTop + el.clientHeight - lineHeight) el.scrollTop = Math.max(0, top - el.clientHeight / 2)
  emitCursor()
}

defineExpose({ select })
</script>

<template>
  <textarea
    ref="textarea"
    v-model="model"
    spellcheck="false"
    autocapitalize="off"
    autocomplete="off"
    class="min-h-[24rem] w-full resize-y rounded-lg border border-neutral-300 bg-white p-3 font-mono text-sm leading-relaxed text-neutral-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-sky-900"
    @keydown.tab.prevent="onTab"
    @keyup="emitCursor"
    @click="emitCursor"
    @input="emitCursor"
    @focus="emitCursor"
    @select="emitCursor"
    @blur="emit('cursor', -1)"
  />
</template>
