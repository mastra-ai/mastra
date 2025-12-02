import { DownloadResult } from '../lib/types';
import StreamDownloadBuilder from './StreamDownloadBuilder';
export default class BlobDownloadBuilder implements Promise<DownloadResult<Blob>> {
    private downloadFn;
    private shouldThrowOnError;
    readonly [Symbol.toStringTag]: string;
    private promise;
    constructor(downloadFn: () => Promise<Response>, shouldThrowOnError: boolean);
    asStream(): StreamDownloadBuilder;
    then<TResult1 = DownloadResult<Blob>, TResult2 = never>(onfulfilled?: ((value: DownloadResult<Blob>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null): Promise<DownloadResult<Blob> | TResult>;
    finally(onfinally?: (() => void) | null): Promise<DownloadResult<Blob>>;
    private getPromise;
    private execute;
}
//# sourceMappingURL=BlobDownloadBuilder.d.ts.map