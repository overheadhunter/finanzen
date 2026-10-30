import { t } from '../i18n'

/** Name of the URL fragment parameter that carries a shared document, as in `#yaml=…`. Fragments never reach the server. */
export const SHARE_PARAM = 'yaml'

/**
 * Compresses a document into a URL-safe string.
 *
 * @param text YAML source
 * @return deflate-compressed, base64url-encoded text
 */
export async function encodeShare(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()))
}

/**
 * Restores a document encoded by {@link encodeShare}.
 *
 * @param encoded the encoded text
 * @return the YAML source
 * @throws Error if the text is not a valid encoding
 */
export async function decodeShare(encoded: string): Promise<string> {
  let bytes: Uint8Array
  try {
    bytes = fromBase64Url(encoded)
  } catch {
    throw new Error(t('share.invalid'))
  }
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return await new Response(stream).text()
  } catch {
    throw new Error(t('share.corrupt'))
  }
}

/** Builds a shareable link for the current page carrying the encoded document in its fragment. */
export function shareUrl(encoded: string, base: Location | URL = location): string {
  return `${base.origin}${base.pathname}${base.search}#${SHARE_PARAM}=${encoded}`
}

/** Extracts the encoded document from a URL fragment, or `null` if there is none. */
export function sharedFragment(hash: string): string | null {
  const match = new RegExp(`^#${SHARE_PARAM}=(.+)$`).exec(hash)
  return match?.[1] ?? null
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}
