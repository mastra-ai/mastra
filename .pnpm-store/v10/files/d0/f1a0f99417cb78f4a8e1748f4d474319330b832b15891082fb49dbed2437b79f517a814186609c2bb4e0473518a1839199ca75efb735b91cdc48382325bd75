import { isStorageError } from '../lib/errors'
import { DownloadResult } from '../lib/types'
import StreamDownloadBuilder from './StreamDownloadBuilder'

export default class BlobDownloadBuilder implements Promise<DownloadResult<Blob>> {
  readonly [Symbol.toStringTag]: string = 'BlobDownloadBuilder'
  private promise: Promise<DownloadResult<Blob>> | null = null

  constructor(
    private downloadFn: () => Promise<Response>,
    private shouldThrowOnError: boolean
  ) {}

  asStream(): StreamDownloadBuilder {
    return new StreamDownloadBuilder(this.downloadFn, this.shouldThrowOnError)
  }

  then<TResult1 = DownloadResult<Blob>, TResult2 = never>(
    onfulfilled?: ((value: DownloadResult<Blob>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.getPromise().then(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<DownloadResult<Blob> | TResult> {
    return this.getPromise().catch(onrejected)
  }

  finally(onfinally?: (() => void) | null): Promise<DownloadResult<Blob>> {
    return this.getPromise().finally(onfinally)
  }

  private getPromise(): Promise<DownloadResult<Blob>> {
    if (!this.promise) {
      this.promise = this.execute()
    }
    return this.promise
  }

  private async execute(): Promise<DownloadResult<Blob>> {
    try {
      const result = await this.downloadFn()

      return {
        data: await result.blob(),
        error: null,
      }
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
