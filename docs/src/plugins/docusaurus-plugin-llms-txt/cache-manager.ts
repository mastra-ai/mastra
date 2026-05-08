/**
 * Cache manager for content hashing and incremental builds
 */

import crypto from 'crypto'
import fs from 'fs-extra'
import path from 'path'

interface CacheEntry {
  hash: string
  timestamp: number
  title?: string
  content?: string
}

interface CacheData {
  version: string
  pluginHash?: string
  entries: Record<string, CacheEntry>
}

const CACHE_VERSION = '1.0.0'
const CACHE_FILENAME = 'llms-txt-cache.json'

export class CacheManager {
  private cacheDir: string
  private cachePath: string
  private enabled: boolean
  private pluginHash: string
  private data: CacheData

  constructor(cacheDir: string, enabled: boolean = true, pluginHash: string = '') {
    this.cacheDir = cacheDir
    this.cachePath = path.join(cacheDir, CACHE_FILENAME)
    this.enabled = enabled
    this.pluginHash = pluginHash
    this.data = { version: CACHE_VERSION, pluginHash, entries: {} }
  }

  async load(): Promise<void> {
    if (!this.enabled) return

    try {
      const exists = await fs.pathExists(this.cachePath)
      if (!exists) return

      const raw = await fs.readFile(this.cachePath, 'utf-8')
      const parsed = JSON.parse(raw) as CacheData

      // Version check - invalidate if version or plugin hash mismatch
      if (parsed.version === CACHE_VERSION && parsed.pluginHash === this.pluginHash) {
        this.data = parsed
      } else {
        console.log('[llms-txt] Cache invalidated due to plugin changes')
      }
    } catch {
      // Cache doesn't exist or is invalid, start fresh
      this.data = { version: CACHE_VERSION, pluginHash: this.pluginHash, entries: {} }
    }
  }

  isValid(route: string, contentHash: string): boolean {
    if (!this.enabled) return false

    const entry = this.data.entries[route]
    return entry?.hash === contentHash
  }

  getTitle(route: string): string | undefined {
    return this.data.entries[route]?.title
  }

  getContent(route: string): string | undefined {
    return this.data.entries[route]?.content
  }

  set(route: string, contentHash: string, title?: string, content?: string): void {
    this.data.entries[route] = {
      hash: contentHash,
      timestamp: Date.now(),
      title,
      content,
    }
  }

  async save(): Promise<void> {
    if (!this.enabled) return

    await fs.ensureDir(this.cacheDir)
    await fs.writeFile(this.cachePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  getEntryCount(): number {
    return Object.keys(this.data.entries).length
  }
}

export function computeHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex')
}
