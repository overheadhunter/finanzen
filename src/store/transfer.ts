import { FILE_EXTENSION } from '../yamlFormat'

export const EXPORT_FILE_NAME = 'finanzen' + FILE_EXTENSION

/** Reads a YAML file chosen by the user. */
export function importYaml(file: File): Promise<string> {
  return file.text()
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
