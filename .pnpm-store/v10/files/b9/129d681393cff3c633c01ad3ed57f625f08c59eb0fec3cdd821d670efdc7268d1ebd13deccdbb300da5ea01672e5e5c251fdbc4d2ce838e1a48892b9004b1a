import { PostHogCore } from '@/posthog-core'
import type {
  JsonType,
  PostHogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogFlagsResponse,
} from '@/types'

const version = '2.0.0-alpha'

export interface PostHogCoreTestClientMocks {
  fetch: jest.Mock<Promise<PostHogFetchResponse>, [string, PostHogFetchOptions]>
  storage: {
    getItem: jest.Mock<any | undefined, [string]>
    setItem: jest.Mock<void, [string, any | null]>
  }
}

export class PostHogCoreTestClient extends PostHogCore {
  public _cachedDistinctId?: string

  constructor(
    private mocks: PostHogCoreTestClientMocks,
    apiKey: string,
    options?: PostHogCoreOptions
  ) {
    super(apiKey, options)

    this.setupBootstrap(options)
  }

  // Expose protected methods for testing
  public getFlags(
    distinctId: string,
    groups: Record<string, string | number> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {},
    extraPayload: Record<string, any> = {}
  ): Promise<PostHogFlagsResponse | undefined> {
    return super.getFlags(distinctId, groups, personProperties, groupProperties, extraPayload)
  }

  getPersistedProperty<T>(key: string): T {
    return this.mocks.storage.getItem(key)
  }
  setPersistedProperty<T>(key: string, value: T | null): void {
    return this.mocks.storage.setItem(key, value)
  }
  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return this.mocks.fetch(url, options)
  }
  getLibraryId(): string {
    return 'posthog-core-tests'
  }
  getLibraryVersion(): string {
    return version
  }
  getCustomUserAgent(): string {
    return 'posthog-core-tests'
  }
}

export const createTestClient = (
  apiKey: string,
  options?: PostHogCoreOptions,
  setupMocks?: (mocks: PostHogCoreTestClientMocks) => void,
  storageCache: { [key: string]: string | JsonType } = {}
): [PostHogCoreTestClient, PostHogCoreTestClientMocks] => {
  const mocks = {
    fetch: jest.fn(),
    storage: {
      getItem: jest.fn((key) => storageCache[key]),
      setItem: jest.fn((key, val) => {
        storageCache[key] = val == null ? undefined : val
      }),
    },
  }

  mocks.fetch.mockImplementation(() =>
    Promise.resolve({
      status: 200,
      text: () => Promise.resolve('ok'),
      json: () => Promise.resolve({ status: 'ok' }),
    })
  )

  setupMocks?.(mocks)

  return [new PostHogCoreTestClient(mocks, apiKey, { disableCompression: true, ...options }), mocks]
}
