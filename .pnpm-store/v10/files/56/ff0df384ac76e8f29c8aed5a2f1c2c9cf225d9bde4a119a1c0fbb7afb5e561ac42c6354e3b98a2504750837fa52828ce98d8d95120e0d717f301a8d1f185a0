"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MutationState = void 0;
/**
 * Aggregates a number of {@link MutationToken}'s which have been returned by mutation
 * operations, which can then be used when performing queries.  This will guarenteed
 * that the query includes the specified set of mutations without incurring the wait
 * associated with request_plus level consistency.
 */
class MutationState {
    constructor(...tokens) {
        this._data = {};
        tokens.forEach((token) => this._addOne(token));
    }
    /**
     * Adds a set of tokens to this state.
     *
     * @param tokens The tokens to add.
     */
    add(...tokens) {
        tokens.forEach((token) => this._addOne(token));
    }
    _addOne(token) {
        if (!token) {
            return;
        }
        const cppToken = token;
        const tokenData = cppToken.toJSON();
        const vbId = parseInt(tokenData.partition_id, 10);
        const vbSeqNo = parseInt(tokenData.sequence_number, 10);
        const bucketName = tokenData.bucket_name;
        if (!this._data[bucketName]) {
            this._data[bucketName] = {};
        }
        if (!this._data[bucketName][vbId]) {
            this._data[bucketName][vbId] = cppToken;
        }
        else {
            const otherToken = this._data[bucketName][vbId];
            const otherTokenSeqNo = parseInt(otherToken.toJSON().sequence, 10);
            if (otherTokenSeqNo < vbSeqNo) {
                this._data[bucketName][vbId] = cppToken;
            }
        }
    }
    /**
     * @internal
     */
    toJSON() {
        return this._data;
    }
    /**
     * @internal
     */
    inspect() {
        const tokens = [];
        for (const bucketName in this._data) {
            for (const vbId in this._data[bucketName]) {
                const info = this._data[bucketName][vbId];
                tokens.push(bucketName + ':' + vbId + ':' + info.toString());
            }
        }
        return 'MutationState<' + tokens.join('; ') + '>';
    }
}
exports.MutationState = MutationState;
