# Finanzen

Browser-App zur Visualisierung von Einnahmen und Ausgaben als Sankey-Diagramm. Läuft komplett lokal im Browser (localStorage), kein Server.

- Die Daten werden als YAML direkt in der App bearbeitet; jede Änderung wird sofort gerendert und lokal gespeichert.
- Einnahmen sind positive, Ausgaben negative Beträge. Kategorien lassen sich beliebig tief verschachteln; netto-positive Hauptkategorien erscheinen links, netto-negative rechts des zentralen Budget-Knotens.
- Jede Hauptkategorie bekommt eine eigene Farbe, Unterkategorien passende Nuancen.
- Schlüssel mit führendem `_` sind für Metadaten reserviert (`_settings`, `_data`). Eine Kategorie ohne Unterkategorien bekommt ihren Betrag über `_settings.value`; mit Unterkategorien wird `value` ignoriert.
- Beträge werden vereinheitlicht, sobald der Cursor die Zeile verlässt: Schreibweisen wie `1.234,56` oder `-1 000` werden korrigiert, Dezimalzahlen auf mindestens `_settings.currency.decimals` Nachkommastellen aufgefüllt (Standard: 2), ganze Zahlen bleiben ohne Nachkommastellen. Die Anzeige rundet auf dieselbe Stellenzahl.
- Import/Export als `.yaml`-Datei zum Übertragen auf andere Geräte.

```yaml
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
```

## Entwicklung

```sh
pnpm install
pnpm dev        # Dev-Server
pnpm test       # Unit-Tests (vitest)
pnpm build      # Typecheck + Production-Build nach dist/
```

## Deployment

Push auf `main` baut und veröffentlicht via GitHub Actions auf GitHub Pages (`base: /finanzen/`). In den Repo-Einstellungen muss die Pages-Quelle einmalig auf „GitHub Actions“ gesetzt werden.
