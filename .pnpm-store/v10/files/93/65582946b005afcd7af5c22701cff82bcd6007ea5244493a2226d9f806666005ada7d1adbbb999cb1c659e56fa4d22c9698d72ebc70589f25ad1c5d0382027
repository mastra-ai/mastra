import { isStorageError } from '../lib/errors'
import { DownloadResult } from '../lib/types'

export default class StreamDownloadBuilder implements PromiseLike<DownloadResult<ReadableStream>> {
  constructor(
    private downloadFn: () => Promise<Response>,
    private shouldThrowOnError: boolean
  ) {}

  then<TResult1 = DownloadResult<ReadableStream>, TResult2 = never>(
    onfulfilled?:
      | ((value: DownloadResult<ReadableStream>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(): Promise<DownloadResult<ReadableStream>> {
    try {
      const result = await this.downloadFn()

      return {
        data: result.body as ReadableStream,
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
