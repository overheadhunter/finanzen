import type { Settings } from './model'

const formats = new Map<number, Intl.NumberFormat>()

/** Formats an amount with the configured fraction digits and currency symbol, e.g. `-1.234,50 €`. */
export function formatAmount(amount: number, settings: Pick<Settings, 'currencySymbol' | 'decimals'>): string {
  let format = formats.get(settings.decimals)
  if (!format) {
    format = new Intl.NumberFormat('de-DE', { minimumFractionDigits: settings.decimals, maximumFractionDigits: settings.decimals })
    formats.set(settings.decimals, format)
  }
  return `${format.format(amount)} ${settings.currencySymbol}`.trim()
}
