import { t } from '../i18n'
import { embedPngText } from './pngText'

export const PNG_FILE_NAME = 'finanzen.png'

// styles the SVG gets from Tailwind classes and scoped CSS, which a standalone SVG image would lose
const INLINED_PROPERTIES = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'paint-order']

/**
 * Rasterizes an SVG element and downloads it as PNG on the background it is shown on (so dark mode exports stay legible), embedding the YAML source as a text chunk so the file can be imported again.
 *
 * @param svg the element as rendered in the page
 * @param yaml the document to embed
 * @param scale device pixels per CSS pixel
 * @param fileName download name
 */
export async function exportPng(svg: SVGSVGElement, yaml: string, scale = 2, fileName = PNG_FILE_NAME) {
  const width = svg.clientWidth || Number(svg.getAttribute('width'))
  const height = svg.clientHeight || Number(svg.getAttribute('height'))
  const image = await loadImage(standaloneSvg(svg))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error(t('png.noCanvas'))
  context.scale(scale, scale)
  context.fillStyle = backgroundOf(svg)
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error(t('png.failed'))
  const withYaml = embedPngText(new Uint8Array(await blob.arrayBuffer()), yaml)
  download(new Blob([withYaml as BlobPart], { type: 'image/png' }), fileName)
}

// the first non-transparent background among the element's ancestors
function backgroundOf(element: Element): string {
  for (let el: Element | null = element; el; el = el.parentElement) {
    const color = getComputedStyle(el).backgroundColor
    if (color && color !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(color)) return color
  }
  return '#ffffff'
}

// serializes a copy of the SVG with the computed styles inlined, so it renders the same outside the page
function standaloneSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  inlineStyles(svg, clone)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return new XMLSerializer().serializeToString(clone)
}

function inlineStyles(source: Element, target: Element) {
  if (target instanceof SVGElement && !(target instanceof SVGTitleElement)) {
    const computed = getComputedStyle(source)
    for (const property of INLINED_PROPERTIES) target.style.setProperty(property, computed.getPropertyValue(property))
    target.removeAttribute('class')
  }
  for (let i = 0; i < source.children.length; i++) inlineStyles(source.children[i]!, target.children[i]!)
}

function loadImage(svgText: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(t('png.render')))
    }
    image.src = url
  })
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
