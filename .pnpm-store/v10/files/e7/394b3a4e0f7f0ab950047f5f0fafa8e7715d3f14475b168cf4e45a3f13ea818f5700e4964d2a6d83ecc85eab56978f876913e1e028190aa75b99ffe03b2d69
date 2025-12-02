import { DownloadResult } from '../lib/types';
export default class StreamDownloadBuilder implements PromiseLike<DownloadResult<ReadableStream>> {
    private downloadFn;
    private shouldThrowOnError;
    constructor(downloadFn: () => Promise<Response>, shouldThrowOnError: boolean);
    then<TResult1 = DownloadResult<ReadableStream>, TResult2 = never>(onfulfilled?: ((value: DownloadResult<ReadableStream>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
    private execute;
}
//# sourceMappingURL=StreamDownloadBuilder.d.ts.map