import { DEFAULT_HEADERS } from '../lib/constants'
import { isStorageError, StorageError } from '../lib/errors'
import { Fetch, get, post, put, remove } from '../lib/fetch'
import { resolveFetch } from '../lib/helpers'
import { Bucket, BucketType } from '../lib/types'
import { StorageClientOptions } from '../StorageClient'

export default class StorageBucketApi {
  protected url: string
  protected headers: { [key: string]: string }
  protected fetch: Fetch
  protected shouldThrowOnError = false

  constructor(
    url: string,
    headers: { [key: string]: string } = {},
    fetch?: Fetch,
    opts?: StorageClientOptions
  ) {
    const baseUrl = new URL(url)

    // if legacy uri is used, replace with new storage host (disables request buffering to allow > 50GB uploads)
    // "project-ref.supabase.co" becomes "project-ref.storage.supabase.co"
    if (opts?.useNewHostname) {
      const isSupabaseHost = /supabase\.(co|in|red)$/.test(baseUrl.hostname)
      if (isSupabaseHost && !baseUrl.hostname.includes('storage.supabase.')) {
        baseUrl.hostname = baseUrl.hostname.replace('supabase.', 'storage.supabase.')
      }
    }

    this.url = baseUrl.href.replace(/\/$/, '')
    this.headers = { ...DEFAULT_HEADERS, ...headers }
    this.fetch = resolveFetch(fetch)
  }

  /**
   * Enable throwing errors instead of returning them.
   */
  public throwOnError(): this {
    this.shouldThrowOnError = true
    return this
  }

  /**
   * Retrieves the details of all Storage buckets within an existing project.
   */
  async listBuckets(): Promise<
    | {
        data: Bucket[]
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await get(this.fetch, `${this.url}/bucket`, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Retrieves the details of an existing Storage bucket.
   *
   * @param id The unique identifier of the bucket you would like to retrieve.
   */
  async getBucket(id: string): Promise<
    | {
        data: Bucket
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await get(this.fetch, `${this.url}/bucket/${id}`, { headers: this.headers })
      return { data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Creates a new Storage bucket
   *
   * @param id A unique identifier for the bucket you are creating.
   * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations. By default, buckets are private.
   * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
   * The global file size limit takes precedence over this value.
   * The default value is null, which doesn't set a per bucket file size limit.
   * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
   * The default value is null, which allows files with all mime types to be uploaded.
   * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
   * @returns newly created bucket id
   * @param options.type (private-beta) specifies the bucket type. see `BucketType` for more details.
   *   - default bucket type is `STANDARD`
   */
  async createBucket(
    id: string,
    options: {
      public: boolean
      fileSizeLimit?: number | string | null
      allowedMimeTypes?: string[] | null
      type?: BucketType
    } = {
      public: false,
    }
  ): Promise<
    | {
        data: Pick<Bucket, 'name'>
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/bucket`,
        {
          id,
          name: id,
          type: options.type,
          public: options.public,
          file_size_limit: options.fileSizeLimit,
          allowed_mime_types: options.allowedMimeTypes,
        },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Updates a Storage bucket
   *
   * @param id A unique identifier for the bucket you are updating.
   * @param options.public The visibility of the bucket. Public buckets don't require an authorization token to download objects, but still require a valid token for all other operations.
   * @param options.fileSizeLimit specifies the max file size in bytes that can be uploaded to this bucket.
   * The global file size limit takes precedence over this value.
   * The default value is null, which doesn't set a per bucket file size limit.
   * @param options.allowedMimeTypes specifies the allowed mime types that this bucket can accept during upload.
   * The default value is null, which allows files with all mime types to be uploaded.
   * Each mime type specified can be a wildcard, e.g. image/*, or a specific mime type, e.g. image/png.
   */
  async updateBucket(
    id: string,
    options: {
      public: boolean
      fileSizeLimit?: number | string | null
      allowedMimeTypes?: string[] | null
    }
  ): Promise<
    | {
        data: { message: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await put(
        this.fetch,
        `${this.url}/bucket/${id}`,
        {
          id,
          name: id,
          public: options.public,
          file_size_limit: options.fileSizeLimit,
          allowed_mime_types: options.allowedMimeTypes,
        },
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Removes all objects inside a single bucket.
   *
   * @param id The unique identifier of the bucket you would like to empty.
   */
  async emptyBucket(id: string): Promise<
    | {
        data: { message: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await post(
        this.fetch,
        `${this.url}/bucket/${id}/empty`,
        {},
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }

  /**
   * Deletes an existing bucket. A bucket can't be deleted with existing objects inside it.
   * You must first `empty()` the bucket.
   *
   * @param id The unique identifier of the bucket you would like to delete.
   */
  async deleteBucket(id: string): Promise<
    | {
        data: { message: string }
        error: null
      }
    | {
        data: null
        error: StorageError
      }
  > {
    try {
      const data = await remove(
        this.fetch,
        `${this.url}/bucket/${id}`,
        {},
        { headers: this.headers }
      )
      return { data, error: null }
    } catch (error) {
      if (this.shouldThrowOnError) {
        throw error
      }
      if (isStorageError(error)) {
        return { data: null, error }
      }

      throw error
    }
  }
}
