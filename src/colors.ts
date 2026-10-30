/**
 * Tailwind 4 palette entries (step 500 unless noted), copied from `tailwindcss/theme.css`.
 *
 * Literal values rather than `var(--color-…)`: Tailwind only emits variables for utilities it finds in the sources, and these colors are only ever used from TypeScript.
 */
export const TAILWIND = {
  amber: 'oklch(76.9% 0.188 70.08)',
  lime: 'oklch(76.8% 0.233 130.85)',
  teal: 'oklch(70.4% 0.14 182.503)',
  sky: 'oklch(68.5% 0.169 237.323)',
  indigo: 'oklch(58.5% 0.233 277.117)',
  violet: 'oklch(60.6% 0.25 292.717)',
  fuchsia: 'oklch(66.7% 0.295 322.15)',
  olive: 'oklch(58% 0.031 107.3)',
  'green-600': 'oklch(62.7% 0.194 149.214)',
  'red-600': 'oklch(57.7% 0.245 27.325)',
  'neutral-500': 'oklch(55.6% 0 0)',
} as const

/** Palette for top-level categories, ordered so that the strongest differences come first. Green and red are reserved for the surplus and deficit nodes. */
export const CATEGORY_COLORS = [TAILWIND.indigo, TAILWIND.fuchsia, TAILWIND.amber, TAILWIND.teal, TAILWIND.lime, TAILWIND.sky, TAILWIND.violet, TAILWIND.olive] as const

export const NEUTRAL_COLOR = TAILWIND['neutral-500']
export const SURPLUS_COLOR = TAILWIND['green-600']
export const DEFICIT_COLOR = TAILWIND['red-600']

/** Color of the n-th top-level category. The palette wraps around after its last entry. */
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
