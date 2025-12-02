/// <reference lib="dom" />

export async function hashSHA1(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('SubtleCrypto API not available')
  }

  const hashBuffer = await subtle.digest('SHA-1', new TextEncoder().encode(text))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
