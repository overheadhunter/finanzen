import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../example'
import { decodeShare, encodeShare, sharedFragment, shareUrl } from './share'

describe('share', () => {
  it('round-trips the document through a compact, URL-safe encoding', async () => {
    const encoded = await encodeShare(EXAMPLES.de)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(encoded.length).toBeLessThan(EXAMPLES.de.length)
    expect(await decodeShare(encoded)).toBe(EXAMPLES.de)
    expect(await decodeShare(await encodeShare('ä: 1 €\n'))).toBe('ä: 1 €\n')
  })

  it('rejects garbage', async () => {
    await expect(decodeShare('%%%')).rejects.toThrow('valid data')
    await expect(decodeShare('AAAA')).rejects.toThrow('decompressed')
  })

  it('builds and parses the fragment', async () => {
    const url = shareUrl('abc', new URL('https://example.org/finanzen/?x=1#old'))
    expect(url).toBe('https://example.org/finanzen/?x=1#yaml=abc')
    expect(sharedFragment(new URL(url).hash)).toBe('abc')
    expect(sharedFragment('#other=1')).toBeNull()
    expect(sharedFragment('')).toBeNull()
  })
})
