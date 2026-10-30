import { computed, ref, watchEffect } from 'vue'

export type Theme = 'auto' | 'light' | 'dark'

// keep in sync with the inline script in index.html, which applies the theme before the first paint
const STORAGE_KEY = 'finanzen.theme'
const ORDER: Theme[] = ['auto', 'light', 'dark']

const stored = localStorage.getItem(STORAGE_KEY)
const theme = ref<Theme>(ORDER.includes(stored as Theme) ? (stored as Theme) : 'auto')
const media = matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(media.matches)
media.addEventListener('change', (e) => (systemDark.value = e.matches))

const dark = computed(() => theme.value === 'dark' || (theme.value === 'auto' && systemDark.value))

watchEffect(() => {
  document.documentElement.classList.toggle('dark', dark.value)
  if (theme.value === 'auto') localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, theme.value)
})

/** The chosen theme (`auto` follows the OS) and a function cycling through automatic, light and dark. */
export function useTheme() {
  return {
    theme,
    cycle: () => (theme.value = ORDER[(ORDER.indexOf(theme.value) + 1) % ORDER.length]!),
  }
}
