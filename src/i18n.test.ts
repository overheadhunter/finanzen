import { afterEach, describe, expect, it } from 'vitest'
import { exampleYaml, EXAMPLES, isExample } from './example'
import { locale, setLocale, t } from './i18n'
import { parseDocument } from './yamlFormat'

describe('i18n', () => {
  afterEach(() => setLocale('en'))

  it('defaults to English outside a German browser and interpolates parameters', () => {
    expect(locale()).toBe('en')
    expect(t('app.imported', { name: 'a.yaml' })).toBe('“a.yaml” imported.')
    setLocale('de')
    expect(t('app.imported', { name: 'a.yaml' })).toBe('„a.yaml“ importiert.')
    expect(t('yaml.amount', { path: 'x' })).toBe('„x“ muss ein endlicher Betrag sein.')
  })

  it('ships a valid example per language', () => {
    expect(exampleYaml()).toBe(EXAMPLES.en)
    setLocale('de')
    expect(exampleYaml()).toBe(EXAMPLES.de)
    for (const yaml of Object.values(EXAMPLES)) {
      expect(isExample(yaml)).toBe(true)
      expect(parseDocument(yaml).categories).toHaveLength(4)
    }
  })
})
