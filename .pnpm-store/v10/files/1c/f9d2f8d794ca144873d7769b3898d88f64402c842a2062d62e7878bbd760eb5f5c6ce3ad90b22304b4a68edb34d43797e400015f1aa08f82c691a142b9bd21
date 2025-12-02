"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const errors_1 = require("../lib/errors");
class StreamDownloadBuilder {
    constructor(downloadFn, shouldThrowOnError) {
        this.downloadFn = downloadFn;
        this.shouldThrowOnError = shouldThrowOnError;
    }
    then(onfulfilled, onrejected) {
        return this.execute().then(onfulfilled, onrejected);
    }
    execute() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
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
                if ((0, errors_1.isStorageError)(error)) {
                    return { data: null, error };
                }
                throw error;
            }
        });
    }
}
exports.default = StreamDownloadBuilder;
//# sourceMappingURL=StreamDownloadBuilder.js.map