const numberFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Formats an amount with two decimals and the currency symbol, e.g. `-1.234,50 €`. */
export function formatAmount(amount: number, currencySymbol: string): string {
  return `${numberFormat.format(amount)} ${currencySymbol}`.trim()
}
