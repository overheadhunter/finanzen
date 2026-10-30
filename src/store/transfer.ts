import { FILE_EXTENSION } from '../yamlFormat'
import { t } from '../i18n'
import { extractPngText } from './pngText'

export const EXPORT_FILE_NAME = 'finanzen' + FILE_EXTENSION
/** Accepted import files: YAML, or a PNG exported by this app (it carries the YAML in a text chunk). */
export const IMPORT_ACCEPT = `${FILE_EXTENSION},.yml,application/yaml,text/yaml,.png,image/png`

/**
 * Reads the YAML from a file chosen by the user: the file's text, or the embedded document of a PNG exported by this app.
 *
 * @param file the chosen file
 * @return YAML source
 * @throws Error if a PNG carries no document
 */
export async function importYaml(file: File): Promise<string> {
  if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) return file.text()
  const yaml = extractPngText(new Uint8Array(await file.arrayBuffer()))
  if (yaml === null) throw new Error(t('png.noData'))
  return yaml
}

/** Triggers a browser download of the given YAML text. */
export function exportYaml(text: string, fileName = EXPORT_FILE_NAME) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/yaml' }))
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
