var _a;
import { __awaiter } from "tslib";
import { isStorageError } from '../lib/errors';
import StreamDownloadBuilder from './StreamDownloadBuilder';
class BlobDownloadBuilder {
    constructor(downloadFn, shouldThrowOnError) {
        this.downloadFn = downloadFn;
        this.shouldThrowOnError = shouldThrowOnError;
        this[_a] = 'BlobDownloadBuilder';
        this.promise = null;
    }
    asStream() {
        return new StreamDownloadBuilder(this.downloadFn, this.shouldThrowOnError);
    }
    then(onfulfilled, onrejected) {
        return this.getPromise().then(onfulfilled, onrejected);
    }
    catch(onrejected) {
        return this.getPromise().catch(onrejected);
    }
    finally(onfinally) {
        return this.getPromise().finally(onfinally);
    }
    getPromise() {
        if (!this.promise) {
            this.promise = this.execute();
        }
        return this.promise;
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.downloadFn();
                return {
                    data: yield result.blob(),
                    error: null,
                };
            }
            catch (error) {
                if (this.shouldThrowOnError) {
                    throw error;
                }
                if (isStorageError(error)) {
                    return { data: null, error };
                }
                throw error;
            }
        });
    }
}
_a = Symbol.toStringTag;
export default BlobDownloadBuilder;
//# sourceMappingURL=BlobDownloadBuilder.js.map