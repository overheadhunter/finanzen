import { describe, expect, it } from 'vitest'
import { EXAMPLE_YAML } from '../example'
import { decodeShare, encodeShare, sharedFragment, shareUrl } from './share'

describe('share', () => {
  it('round-trips the document through a compact, URL-safe encoding', async () => {
    const encoded = await encodeShare(EXAMPLE_YAML)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(encoded.length).toBeLessThan(EXAMPLE_YAML.length)
    expect(await decodeShare(encoded)).toBe(EXAMPLE_YAML)
    expect(await decodeShare(await encodeShare('ä: 1 €\n'))).toBe('ä: 1 €\n')
  })

  it('rejects garbage', async () => {
    await expect(decodeShare('%%%')).rejects.toThrow('gültigen Daten')
    await expect(decodeShare('AAAA')).rejects.toThrow('entpackt')
  })

  it('builds and parses the fragment', async () => {
    const url = shareUrl('abc', new URL('https://example.org/finanzen/?x=1#old'))
    expect(url).toBe('https://example.org/finanzen/?x=1#yaml=abc')
    expect(sharedFragment(new URL(url).hash)).toBe('abc')
    expect(sharedFragment('#other=1')).toBeNull()
    expect(sharedFragment('')).toBeNull()
  })
})
