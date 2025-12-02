"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const constants_1 = require("../lib/constants");
const errors_1 = require("../lib/errors");
const fetch_1 = require("../lib/fetch");
const helpers_1 = require("../lib/helpers");
class StorageBucketApi {
    constructor(url, headers = {}, fetch, opts) {
        this.shouldThrowOnError = false;
        const baseUrl = new URL(url);
        // if legacy uri is used, replace with new storage host (disables request buffering to allow > 50GB uploads)
        // "project-ref.supabase.co" becomes "project-ref.storage.supabase.co"
        if (opts === null || opts === void 0 ? void 0 : opts.useNewHostname) {
            const isSupabaseHost = /supabase\.(co|in|red)$/.test(baseUrl.hostname);
            if (isSupabaseHost && !baseUrl.hostname.includes('storage.supabase.')) {
                baseUrl.hostname = baseUrl.hostname.replace('supabase.', 'storage.supabase.');
            }
        }
        this.url = baseUrl.href.replace(/\/$/, '');
        this.headers = Object.assign(Object.assign({}, constants_1.DEFAULT_HEADERS), headers);
        this.fetch = (0, helpers_1.resolveFetch)(fetch);
    }
    /**
     * Enable throwing errors instead of returning them.
     */
    throwOnError() {
        this.shouldThrowOnError = true;
        return this;
    }
    /**
     * Retrieves the details of all Storage buckets within an existing project.
     */
    listBuckets() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield (0, fetch_1.get)(this.fetch, `${this.url}/bucket`, { headers: this.headers });
                return { data, error: null };
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
    /**
     * Retrieves the details of an existing Storage bucket.
     *
     * @param id The unique identifier of the bucket you would like to retrieve.
     */
    getBucket(id) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield (0, fetch_1.get)(this.fetch, `${this.url}/bucket/${id}`, { headers: this.headers });
                return { data, error: null };
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
    createBucket(id_1) {
        return tslib_1.__awaiter(this, arguments, void 0, function* (id, options = {
            public: false,
        }) {
            try {
                const data = yield (0, fetch_1.post)(this.fetch, `${this.url}/bucket`, {
                    id,
                    name: id,
                    type: options.type,
                    public: options.public,
                    file_size_limit: options.fileSizeLimit,
                    allowed_mime_types: options.allowedMimeTypes,
                }, { headers: this.headers });
                return { data, error: null };
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
    updateBucket(id, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield (0, fetch_1.put)(this.fetch, `${this.url}/bucket/${id}`, {
                    id,
                    name: id,
                    public: options.public,
                    file_size_limit: options.fileSizeLimit,
                    allowed_mime_types: options.allowedMimeTypes,
                }, { headers: this.headers });
                return { data, error: null };
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
    /**
     * Removes all objects inside a single bucket.
     *
     * @param id The unique identifier of the bucket you would like to empty.
     */
    emptyBucket(id) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield (0, fetch_1.post)(this.fetch, `${this.url}/bucket/${id}/empty`, {}, { headers: this.headers });
                return { data, error: null };
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
    /**
     * Deletes an existing bucket. A bucket can't be deleted with existing objects inside it.
     * You must first `empty()` the bucket.
     *
     * @param id The unique identifier of the bucket you would like to delete.
     */
    deleteBucket(id) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield (0, fetch_1.remove)(this.fetch, `${this.url}/bucket/${id}`, {}, { headers: this.headers });
                return { data, error: null };
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
exports.default = StorageBucketApi;
//# sourceMappingURL=StorageBucketApi.js.map