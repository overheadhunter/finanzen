/** Example document shown on first start and loadable via the "Beispiel" button. */
export const EXAMPLE_YAML = `# Einnahmen sind positiv, Ausgaben negativ. Kategorien lassen sich beliebig tief verschachteln.
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
`
