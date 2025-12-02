"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.RRFReranker = void 0;
const arrow_1 = require("../arrow");
const native_1 = require("../native");
/**
 * Reranks the results using the Reciprocal Rank Fusion (RRF) algorithm.
 *
 * @hideconstructor
 */
class RRFReranker {
    inner;
    /** @ignore */
    constructor(inner) {
        this.inner = inner;
    }
    static async create(k = 60) {
        return new RRFReranker(await native_1.RrfReranker.tryNew(new Float32Array([k])));
    }
    async rerankHybrid(query, vecResults, ftsResults) {
        const buffer = await this.inner.rerankHybrid(query, await (0, arrow_1.fromRecordBatchToBuffer)(vecResults), await (0, arrow_1.fromRecordBatchToBuffer)(ftsResults));
        const recordBatch = await (0, arrow_1.fromBufferToRecordBatch)(buffer);
        return recordBatch;
    }
}
exports.RRFReranker = RRFReranker;
