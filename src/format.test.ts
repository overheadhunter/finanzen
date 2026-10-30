import { describe, expect, it } from 'vitest'
import { formatAmount } from './format'

describe('formatAmount', () => {
  it('uses the configured decimals and currency symbol', () => {
    expect(formatAmount(-1234.5, { currencySymbol: '€', decimals: 2 })).toBe('-1.234,50 €')
    expect(formatAmount(1234.56, { currencySymbol: 'CHF', decimals: 0 })).toBe('1.235 CHF')
    expect(formatAmount(1, { currencySymbol: '', decimals: 3 })).toBe('1,000')
  })
})
