export const PNG_FILE_NAME = 'finanzen.png'

// styles the SVG gets from Tailwind classes and scoped CSS, which a standalone SVG image would lose
const INLINED_PROPERTIES = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'paint-order']

/**
 * Rasterizes an SVG element and downloads it as PNG with a white background.
 *
 * @param svg the element as rendered in the page
 * @param scale device pixels per CSS pixel
 * @param fileName download name
 */
export async function exportPng(svg: SVGSVGElement, scale = 2, fileName = PNG_FILE_NAME) {
  const width = svg.clientWidth || Number(svg.getAttribute('width'))
  const height = svg.clientHeight || Number(svg.getAttribute('height'))
  const image = await loadImage(standaloneSvg(svg))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas wird nicht unterstützt.')
  context.scale(scale, scale)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNG konnte nicht erzeugt werden.')
  download(blob, fileName)
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
      reject(new Error('Das Diagramm konnte nicht gerendert werden.'))
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
