import { t } from '../i18n'

/** Keyword of the PNG text chunk that carries the YAML document; reverse domain name to avoid collisions with other tools' chunks. */
export const PNG_TEXT_KEYWORD = 'de.sebastianstenzel.finanzen'

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const ITXT = 'iTXt'

/**
 * Inserts an `iTXt` chunk (UTF-8, uncompressed) with the given keyword after the PNG header, replacing an existing chunk with that keyword.
 *
 * @param png the PNG file
 * @param text the text to embed
 * @param keyword chunk keyword, Latin-1, 1–79 characters
 * @return a new PNG file
 * @throws Error if `png` is not a PNG
 */
export function embedPngText(png: Uint8Array, text: string, keyword = PNG_TEXT_KEYWORD): Uint8Array {
  const chunks = readChunks(png).filter((c) => !(c.type === ITXT && keywordOf(c.data) === keyword))
  const data = concat(latin1(keyword), [0, 0, 0], [0], [0], new TextEncoder().encode(text))
  chunks.splice(1, 0, { type: ITXT, data })
  return concat(SIGNATURE, ...chunks.flatMap((c) => [encodeChunk(c)]))
}

/**
 * Reads the text of the `iTXt` chunk with the given keyword.
 *
 * @param png the PNG file
 * @param keyword chunk keyword
 * @return the text, or `null` if there is no such chunk
 * @throws Error if `png` is not a PNG
 */
export function extractPngText(png: Uint8Array, keyword = PNG_TEXT_KEYWORD): string | null {
  for (const chunk of readChunks(png)) {
    if (chunk.type !== ITXT || keywordOf(chunk.data) !== keyword) continue
    // keyword\0 compressionFlag compressionMethod languageTag\0 translatedKeyword\0 text
    let offset = chunk.data.indexOf(0) + 1
    const compressed = chunk.data[offset] === 1
    offset += 2
    offset = chunk.data.indexOf(0, offset) + 1
    offset = chunk.data.indexOf(0, offset) + 1
    if (compressed) throw new Error(t('png.compressed'))
    return new TextDecoder().decode(chunk.data.subarray(offset))
  }
  return null
}

interface Chunk {
  type: string
  data: Uint8Array
}

function readChunks(png: Uint8Array): Chunk[] {
  if (png.length < 8 || SIGNATURE.some((b, i) => png[i] !== b)) throw new Error(t('png.notPng'))
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const chunks: Chunk[] = []
  let offset = 8
  while (offset + 12 <= png.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8))
    chunks.push({ type, data: png.subarray(offset + 8, offset + 8 + length) })
    offset += 12 + length
  }
  if (chunks[0]?.type !== 'IHDR') throw new Error(t('png.notPng'))
  return chunks
}

function encodeChunk(chunk: Chunk): Uint8Array {
  const typeAndData = concat(latin1(chunk.type), chunk.data)
  const out = new Uint8Array(12 + chunk.data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, chunk.data.length)
  out.set(typeAndData, 4)
  view.setUint32(8 + chunk.data.length, crc32(typeAndData))
  return out
}

function keywordOf(data: Uint8Array): string {
  const end = data.indexOf(0)
  return String.fromCharCode(...data.subarray(0, end === -1 ? data.length : end))
}

function latin1(text: string): Uint8Array {
  return Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff)
}

function concat(...parts: ArrayLike<number>[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
