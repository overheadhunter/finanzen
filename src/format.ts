import { locale, NUMBER_LOCALES } from './i18n'
import type { Settings } from './model'

const formats = new Map<string, Intl.NumberFormat>()

/** Formats an amount in the active language with the configured fraction digits and currency symbol, e.g. `-1,234.50 €` or `-1.234,50 €`. */
export function formatAmount(amount: number, settings: Pick<Settings, 'currencySymbol' | 'decimals'>): string {
  const tag = NUMBER_LOCALES[locale()]
  const key = `${tag}/${settings.decimals}`
  let format = formats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(tag, { minimumFractionDigits: settings.decimals, maximumFractionDigits: settings.decimals })
    formats.set(key, format)
  }
  return `${format.format(amount)} ${settings.currencySymbol}`.trim()
}
