import { locale, type Locale } from './i18n'

/** Example documents per language, shown on first start and loadable via the example button. */
export const EXAMPLES: Record<Locale, string> = {
  en: `# https://sebastianstenzel.de/finanzen/
# Income is positive, expenses are negative. Categories can be nested as deeply as you like.
# Keys starting with "_" are reserved for metadata. A category without subcategories gets its amount via "_settings.value".
_settings:
  version: 1
  currency:
    symbol: €

_data:
  Salary: 1900.00
  Misc:
    _settings:
      displayname: "Other income"
      value: 400.00
  Housing:
    Rent: -850
    Electricity: -100
  daily:
    _settings:
      displayname: "Daily needs"
    Groceries: -400
    Car: -250
`,
  de: `# https://sebastianstenzel.de/finanzen/
# Einnahmen sind positiv, Ausgaben negativ. Kategorien lassen sich beliebig tief verschachteln.
# Schlüssel mit führendem "_" sind für Metadaten reserviert. Eine Kategorie ohne Unterkategorien bekommt ihren Betrag über "_settings.value".
_settings:
  version: 1
  currency:
    symbol: €

_data:
  Gehalt: 1900.00
  Misc:
    _settings:
      displayname: "Weitere Einkünfte"
      value: 400.00
  Wohnen:
    Miete: -850
    Strom: -100
  daily:
    _settings:
      displayname: "Täglicher Bedarf"
    Lebensmittel: -400
    Auto: -250
`,
}

/** The example document in the active language. */
export function exampleYaml(): string {
  return EXAMPLES[locale()]
}

/** Whether the text is one of the example documents (in any language). */
export function isExample(text: string): boolean {
  return Object.values(EXAMPLES).includes(text)
}
