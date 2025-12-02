import { __awaiter } from "tslib";
import { isStorageError } from '../lib/errors';
export default class StreamDownloadBuilder {
    constructor(downloadFn, shouldThrowOnError) {
        this.downloadFn = downloadFn;
        this.shouldThrowOnError = shouldThrowOnError;
    }
    then(onfulfilled, onrejected) {
        return this.execute().then(onfulfilled, onrejected);
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.downloadFn();
                return {
                    data: result.body,
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
//# sourceMappingURL=StreamDownloadBuilder.js.map