/** Categorical palette (fixed order) for top-level categories; see the dataviz reference palette. */
export const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'] as const

export const NEUTRAL_COLOR = '#898781'
export const SURPLUS_COLOR = '#0ca30c'
export const DEFICIT_COLOR = '#d03b3b'

/** Color of the n-th top-level category. The palette wraps around after eight categories. */
export function categoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length]!
}

/**
 * A nuance of a base color for a subcategory, computed in OKLCH via CSS relative color syntax.
 *
 * @param base the top-level category's color
 * @param lightness lightness offset (0..~0.3); deeper levels get lighter
 * @param hue hue offset in degrees; siblings fan out around the parent's hue
 * @return a CSS color string
 */
export function nuance(base: string, lightness: number, hue: number): string {
  if (lightness === 0 && hue === 0) return base
  return `oklch(from ${base} calc(l + ${round(lightness)}) calc(c * ${round(1 - lightness)}) calc(h + ${round(hue)}))`
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
