import { describe, expect, it } from 'vitest'
import { computeHash } from '../cache-manager'

describe('computeHash', () => {
  it('uses the first 32 lowercase SHA-256 hex characters for cache keys', async () => {
    await expect(computeHash('')).resolves.toBe('e3b0c44298fc1c149afbf4c8996fb924')
    await expect(computeHash('héllo')).resolves.toBe('3c48591d8d098a4538f5e013dfcf406e')
  })

  it('preserves the MD5-era cache-key shape while invalidating prior cache versions', async () => {
    const hash = await computeHash('same source content')

    expect(hash).toMatch(/^[0-9a-f]{32}$/)
    expect(hash).not.toBe(await computeHash('changed source content'))
  })
})
