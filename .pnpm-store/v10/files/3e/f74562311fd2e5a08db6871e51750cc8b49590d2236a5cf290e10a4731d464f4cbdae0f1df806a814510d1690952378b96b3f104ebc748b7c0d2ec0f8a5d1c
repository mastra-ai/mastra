import { PostHogPersistedProperty } from '@posthog/core'

export class PostHogMemoryStorage {
  private _memoryStorage: { [key: string]: any | undefined } = {}

  getProperty(key: PostHogPersistedProperty): any | undefined {
    return this._memoryStorage[key]
  }

  setProperty(key: PostHogPersistedProperty, value: any | null): void {
    this._memoryStorage[key] = value !== null ? value : undefined
  }
}
