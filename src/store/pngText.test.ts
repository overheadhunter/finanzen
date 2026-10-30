import { describe, expect, it } from 'vitest'
import { embedPngText, extractPngText } from './pngText'

// the smallest structure that passes as a PNG: signature, an IHDR and an IEND chunk (CRCs are not validated on reading)
function minimalPng(): Uint8Array {
  const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...type.split('').map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0]
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', new Array(13).fill(0)), ...chunk('IEND', [])])
}

describe('png text chunks', () => {
  it('embeds and extracts UTF-8 text', () => {
    const yaml = '_data:\n  Gehalt: 1900 # €\n  Café: -3\n'
    const png = embedPngText(minimalPng(), yaml)
    expect(extractPngText(png)).toBe(yaml)
    expect(extractPngText(minimalPng())).toBeNull()
    // the chunk sits right after IHDR and carries a valid CRC (checked against the known CRC of "IEND")
    expect(String.fromCharCode(...png.subarray(8 + 12 + 13 + 4, 8 + 12 + 13 + 8))).toBe('iTXt')
    expect(Array.from(png.subarray(png.length - 4))).toEqual([0xae, 0x42, 0x60, 0x82])
  })

  it('replaces an existing chunk instead of adding a second one', () => {
    const once = embedPngText(minimalPng(), 'a: 1')
    const twice = embedPngText(once, 'b: 2')
    expect(extractPngText(twice)).toBe('b: 2')
    expect(twice.length).toBe(once.length)
  })

  it('rejects other files', () => {
    expect(() => extractPngText(new TextEncoder().encode('_data: {}'))).toThrow('kein PNG')
  })
})
