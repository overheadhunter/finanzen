export type Locale = 'en' | 'de'

const en = {
  'app.theme.auto': 'Theme: automatic (follows the system). Click for light.',
  'app.theme.light': 'Theme: light. Click for dark.',
  'app.theme.dark': 'Theme: dark. Click for automatic.',
  'app.themeLabel.auto': 'Auto',
  'app.themeLabel.light': 'Light',
  'app.themeLabel.dark': 'Dark',
  'app.example': 'Example',
  'app.exampleTitle': 'Load the example',
  'app.import': 'Import…',
  'app.importTitle': 'Load a {ext} file or an exported PNG',
  'app.png': 'PNG',
  'app.pngTitle': 'Save the diagram as PNG',
  'app.print': 'Print',
  'app.printTitle': 'Print the diagram (A4 landscape)',
  'app.share': 'Share',
  'app.shareTitle': 'Copy a link containing the current data',
  'app.export': 'Export',
  'app.exportTitle': 'Save as {ext} file',
  'app.income': 'Income',
  'app.expenses': 'Expenses',
  'app.balance': 'Balance',
  'app.yamlHint': 'Changes apply immediately and are stored locally.',
  'app.localNote': 'All data is stored only in this browser. To move it to another device, export the YAML file and import it there.',
  'app.dropHere': 'Drop a YAML or PNG file here',
  'app.replaceWithExample': 'Replace the current content with the example?',
  'app.noDiagram': 'There is no diagram to export.',
  'app.pngFailed': 'PNG export failed.',
  'app.importFailed': 'Import failed.',
  'app.imported': '“{name}” imported.',
  'app.notYamlOrPng': '“{name}” is neither a YAML nor a PNG file.',
  'app.linkCopied': 'Link copied to the clipboard.',
  'app.linkPrompt': 'Link to share:',
  'app.loadShared': 'Load the shared data and replace the current content?',
  'app.sharedFailed': 'The shared link could not be loaded.',
  'diagram.empty': 'No amounts yet. Add income (positive) and expenses (negative) under “_data”.',
  'graph.center': 'Budget',
  'graph.surplus': 'Surplus',
  'graph.deficit': 'Deficit',
  'yaml.invalid': 'Invalid YAML: {message}',
  'yaml.rootMap': 'The top level must be a map with “_settings” and “_data”.',
  'yaml.dataMap': '“_data” must be a map of categories.',
  'yaml.settingsMap': '“_settings” must be a map.',
  'yaml.version': 'Unsupported version {version} (expected {expected}).',
  'yaml.currencyMap': '“_settings.currency” must be a map.',
  'yaml.symbol': '“_settings.currency.symbol” must be a string.',
  'yaml.decimals': '“_settings.currency.decimals” must be an integer between 0 and 20.',
  'yaml.amount': '“{path}” must be a finite amount.',
  'yaml.amountOrMap': '“{path}” must be an amount or a map of subcategories.',
  'yaml.categorySettingsMap': '“{path}”: “_settings” must be a map.',
  'yaml.displayname': '“{path}”: “_settings.displayname” must be a string.',
  'yaml.value': '“{path}”: “_settings.value” must be a finite amount.',
  'share.invalid': 'The link does not contain valid data.',
  'share.corrupt': 'The data in the link could not be decompressed.',
  'png.noCanvas': 'Canvas is not supported.',
  'png.failed': 'The PNG could not be created.',
  'png.render': 'The diagram could not be rendered.',
  'png.notPng': 'The file is not a PNG.',
  'png.compressed': 'Compressed PNG text data is not supported.',
  'png.noData': 'The PNG does not contain any Finanzen data.',
}

export type MessageKey = keyof typeof en

const de: Record<MessageKey, string> = {
  'app.theme.auto': 'Darstellung: automatisch (wie das System). Klicken für hell.',
  'app.theme.light': 'Darstellung: hell. Klicken für dunkel.',
  'app.theme.dark': 'Darstellung: dunkel. Klicken für automatisch.',
  'app.themeLabel.auto': 'Auto',
  'app.themeLabel.light': 'Hell',
  'app.themeLabel.dark': 'Dunkel',
  'app.example': 'Beispiel',
  'app.exampleTitle': 'Beispiel laden',
  'app.import': 'Importieren…',
  'app.importTitle': '{ext}-Datei oder exportiertes PNG laden',
  'app.png': 'PNG',
  'app.pngTitle': 'Diagramm als PNG speichern',
  'app.print': 'Drucken',
  'app.printTitle': 'Diagramm drucken (A4 quer)',
  'app.share': 'Teilen',
  'app.shareTitle': 'Link mit den aktuellen Daten kopieren',
  'app.export': 'Exportieren',
  'app.exportTitle': 'Als {ext}-Datei speichern',
  'app.income': 'Einnahmen',
  'app.expenses': 'Ausgaben',
  'app.balance': 'Saldo',
  'app.yamlHint': 'Änderungen werden sofort übernommen und lokal gespeichert.',
  'app.localNote': 'Alle Daten werden ausschließlich lokal in diesem Browser gespeichert. Zum Übertragen auf ein anderes Gerät die YAML-Datei exportieren und dort importieren.',
  'app.dropHere': 'YAML- oder PNG-Datei hier ablegen',
  'app.replaceWithExample': 'Aktuellen Inhalt durch das Beispiel ersetzen?',
  'app.noDiagram': 'Kein Diagramm vorhanden.',
  'app.pngFailed': 'PNG-Export fehlgeschlagen.',
  'app.importFailed': 'Import fehlgeschlagen.',
  'app.imported': '„{name}“ importiert.',
  'app.notYamlOrPng': '„{name}“ ist weder eine YAML- noch eine PNG-Datei.',
  'app.linkCopied': 'Link in die Zwischenablage kopiert.',
  'app.linkPrompt': 'Link zum Teilen:',
  'app.loadShared': 'Geteilte Daten laden und den aktuellen Inhalt ersetzen?',
  'app.sharedFailed': 'Der geteilte Link konnte nicht geladen werden.',
  'diagram.empty': 'Keine Beträge vorhanden. Trage unter „_data“ Einnahmen (positiv) und Ausgaben (negativ) ein.',
  'graph.center': 'Budget',
  'graph.surplus': 'Überschuss',
  'graph.deficit': 'Defizit',
  'yaml.invalid': 'Ungültiges YAML: {message}',
  'yaml.rootMap': 'Die Datei muss auf oberster Ebene eine Map mit „_settings“ und „_data“ sein.',
  'yaml.dataMap': '„_data“ muss eine Map aus Kategorien sein.',
  'yaml.settingsMap': '„_settings“ muss eine Map sein.',
  'yaml.version': 'Nicht unterstützte Version {version} (erwartet: {expected}).',
  'yaml.currencyMap': '„_settings.currency“ muss eine Map sein.',
  'yaml.symbol': '„_settings.currency.symbol“ muss ein Text sein.',
  'yaml.decimals': '„_settings.currency.decimals“ muss eine ganze Zahl zwischen 0 und 20 sein.',
  'yaml.amount': '„{path}“ muss ein endlicher Betrag sein.',
  'yaml.amountOrMap': '„{path}“ muss ein Betrag oder eine Map aus Unterkategorien sein.',
  'yaml.categorySettingsMap': '„{path}“: „_settings“ muss eine Map sein.',
  'yaml.displayname': '„{path}“: „_settings.displayname“ muss ein Text sein.',
  'yaml.value': '„{path}“: „_settings.value“ muss ein endlicher Betrag sein.',
  'share.invalid': 'Der Link enthält keine gültigen Daten.',
  'share.corrupt': 'Die Daten im Link konnten nicht entpackt werden.',
  'png.noCanvas': 'Canvas wird nicht unterstützt.',
  'png.failed': 'PNG konnte nicht erzeugt werden.',
  'png.render': 'Das Diagramm konnte nicht gerendert werden.',
  'png.notPng': 'Die Datei ist kein PNG.',
  'png.compressed': 'Komprimierte PNG-Textdaten werden nicht unterstützt.',
  'png.noData': 'Das PNG enthält keine Finanzen-Daten.',
}

const messages: Record<Locale, Record<MessageKey, string>> = { en, de }

/** BCP 47 tags used for number formatting per locale. */
export const NUMBER_LOCALES: Record<Locale, string> = { en: 'en-US', de: 'de-DE' }

// English unless the browser's primary language is German; outside a browser (tests) always English
let current: Locale = typeof navigator !== 'undefined' && typeof window !== 'undefined' && /^de\b/i.test(navigator.language) ? 'de' : 'en'

/** The active UI language. */
export function locale(): Locale {
  return current
}

/** Overrides the detected language, mainly for tests. */
export function setLocale(next: Locale) {
  current = next
}

/**
 * Translates a message into the active language.
 *
 * @param key message key
 * @param params values for `{name}` placeholders
 * @return the translated text
 */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return messages[current][key].replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}
