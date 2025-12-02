"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const errors_1 = require("../lib/errors");
const StreamDownloadBuilder_1 = tslib_1.__importDefault(require("./StreamDownloadBuilder"));
class BlobDownloadBuilder {
    constructor(downloadFn, shouldThrowOnError) {
        this.downloadFn = downloadFn;
        this.shouldThrowOnError = shouldThrowOnError;
        this[_a] = 'BlobDownloadBuilder';
        this.promise = null;
    }
    asStream() {
        return new StreamDownloadBuilder_1.default(this.downloadFn, this.shouldThrowOnError);
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
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
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
                if ((0, errors_1.isStorageError)(error)) {
                    return { data: null, error };
                }
                throw error;
            }
        });
    }
}
_a = Symbol.toStringTag;
exports.default = BlobDownloadBuilder;
//# sourceMappingURL=BlobDownloadBuilder.js.map