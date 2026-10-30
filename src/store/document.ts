import { ref, watch } from 'vue'
import { exampleYaml } from '../example'

const STORAGE_KEY = 'finanzen.yaml'

/** The YAML source text, persisted to localStorage on every change. Starts with the example document. */
export function useDocumentText() {
  const text = ref(localStorage.getItem(STORAGE_KEY) ?? exampleYaml())
  watch(text, (value) => localStorage.setItem(STORAGE_KEY, value))
  return text
}
