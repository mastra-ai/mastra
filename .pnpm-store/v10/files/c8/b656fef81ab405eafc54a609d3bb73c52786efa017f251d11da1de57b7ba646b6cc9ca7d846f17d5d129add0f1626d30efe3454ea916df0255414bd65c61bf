"use strict";
/**
 * Copyright 2024 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryUtil = void 0;
const stream_1 = require("stream");
const timestamp_1 = require("../timestamp");
const document_1 = require("../document");
const util_1 = require("../util");
const document_change_1 = require("../document-change");
const query_profile_1 = require("../query-profile");
const logger_1 = require("../logger");
const vector_query_1 = require("./vector-query");
const types_1 = require("./types");
const constants_1 = require("./constants");
const trace_util_1 = require("../telemetry/trace-util");
class QueryUtil {
    constructor(
    /** @private */
    _firestore, 
    /** @private */
    _queryOptions, 
    /** @private */
    _serializer) {
        this._firestore = _firestore;
        this._queryOptions = _queryOptions;
        this._serializer = _serializer;
    }
    _getResponse(query, transactionOrReadTime, retryWithCursor = true, explainOptions) {
        // Capture the error stack to preserve stack tracing across async calls.
        const stack = Error().stack;
        return new Promise((resolve, reject) => {
            const docs = [];
            const output = {};
            this._stream(query, transactionOrReadTime, retryWithCursor, explainOptions)
                .on('error', err => {
                reject((0, util_1.wrapError)(err, stack));
            })
                .on('data', (data) => {
                if (data.transaction) {
                    output.transaction = data.transaction;
                }
                if (data.readTime) {
                    output.readTime = data.readTime;
                }
                if (data.explainMetrics) {
                    output.explainMetrics = data.explainMetrics;
                }
                if (data.document) {
                    docs.push(data.document);
                }
            })
                .on('end', () => {
                if (this._queryOptions.limitType === types_1.LimitType.Last) {
                    // The results for limitToLast queries need to be flipped since
                    // we reversed the ordering constraints before sending the query
                    // to the backend.
                    docs.reverse();
                }
                // Only return a snapshot when we have a readTime
                // explain queries with analyze !== true will return no documents and no read time
                const result = output.readTime
                    ? query._createSnapshot(output.readTime, docs.length, () => docs, () => {
                        const changes = [];
                        for (let i = 0; i < docs.length; ++i) {
                            changes.push(new document_change_1.DocumentChange('added', docs[i], -1, i));
                        }
                        return changes;
                    })
                    : undefined;
                resolve({
                    transaction: output.transaction,
                    explainMetrics: output.explainMetrics,
                    result,
                });
            });
        });
    }
    // This method exists solely to enable unit tests to mock it.
    _isPermanentRpcError(err, methodName) {
        return (0, util_1.isPermanentRpcError)(err, methodName);
    }
    _hasRetryTimedOut(methodName, startTime) {
        const totalTimeout = (0, util_1.getTotalTimeout)(methodName);
        if (totalTimeout === 0) {
            return false;
        }
        return Date.now() - startTime >= totalTimeout;
    }
    stream(query) {
        if (this._queryOptions.limitType === types_1.LimitType.Last) {
            throw new Error('Query results for queries that include limitToLast() ' +
                'constraints cannot be streamed. Use Query.get() instead.');
        }
        const responseStream = this._stream(query);
        const transform = new stream_1.Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                callback(undefined, chunk.document);
            },
        });
        responseStream.pipe(transform);
        responseStream.on('error', e => transform.destroy(e));
        return transform;
    }
    _stream(query, transactionOrReadTime, retryWithCursor = true, explainOptions) {
        const tag = (0, util_1.requestTag)();
        const startTime = Date.now();
        const isExplain = explainOptions !== undefined;
        const methodName = 'runQuery';
        let numDocumentsReceived = 0;
        let lastReceivedDocument = null;
        let backendStream;
        const stream = new stream_1.Transform({
            objectMode: true,
            transform: (proto, enc, callback) => {
                var _a;
                if (proto === constants_1.NOOP_MESSAGE) {
                    callback(undefined);
                    return;
                }
                const output = {};
                // Proto comes with zero-length buffer by default
                if ((_a = proto.transaction) === null || _a === void 0 ? void 0 : _a.length) {
                    output.transaction = proto.transaction;
                }
                if (proto.readTime) {
                    output.readTime = timestamp_1.Timestamp.fromProto(proto.readTime);
                }
                if (proto.document) {
                    const document = this._firestore.snapshot_(proto.document, proto.readTime);
                    const finalDoc = new document_1.DocumentSnapshotBuilder(document.ref.withConverter(this._queryOptions.converter));
                    // Recreate the QueryDocumentSnapshot with the DocumentReference
                    // containing the original converter.
                    finalDoc.fieldsProto = document._fieldsProto;
                    finalDoc.readTime = document.readTime;
                    finalDoc.createTime = document.createTime;
                    finalDoc.updateTime = document.updateTime;
                    lastReceivedDocument = finalDoc.build();
                    output.document = lastReceivedDocument;
                }
                if (proto.explainMetrics) {
                    output.explainMetrics = query_profile_1.ExplainMetrics._fromProto(proto.explainMetrics, this._serializer);
                }
                ++numDocumentsReceived;
                callback(undefined, output);
                if (proto.done) {
                    (0, logger_1.logger)('QueryUtil._stream', tag, 'Trigger Logical Termination.');
                    this._firestore._traceUtil
                        .currentSpan()
                        .addEvent(`Firestore.${methodName}: Received RunQueryResponse.Done.`);
                    backendStream.unpipe(stream);
                    backendStream.resume();
                    backendStream.end();
                    stream.end();
                }
            },
        });
        this._firestore
            .initializeIfNeeded(tag)
            .then(async () => {
            // `toProto()` might throw an exception. We rely on the behavior of an
            // async function to convert this exception into the rejected Promise we
            // catch below.
            let request = query.toProto(transactionOrReadTime, explainOptions);
            let isRetryRequestWithCursor = false;
            let streamActive;
            do {
                streamActive = new util_1.Deferred();
                this._firestore._traceUtil
                    .currentSpan()
                    .addEvent(trace_util_1.SPAN_NAME_RUN_QUERY, {
                    [trace_util_1.ATTRIBUTE_KEY_IS_TRANSACTIONAL]: !!request.transaction,
                    [trace_util_1.ATTRIBUTE_KEY_IS_RETRY_WITH_CURSOR]: isRetryRequestWithCursor,
                });
                backendStream = await this._firestore.requestStream(methodName, 
                /* bidirectional= */ false, request, tag);
                backendStream.on('error', err => {
                    backendStream.unpipe(stream);
                    // If a non-transactional query failed, attempt to restart.
                    // Transactional queries are retried via the transaction runner.
                    // Explain queries are not retried with a cursor. That would produce
                    // incorrect/partial profiling results.
                    if (!isExplain &&
                        !transactionOrReadTime &&
                        !this._isPermanentRpcError(err, methodName)) {
                        (0, logger_1.logger)('QueryUtil._stream', tag, 'Query failed with retryable stream error:', err);
                        this._firestore._traceUtil
                            .currentSpan()
                            .addEvent(`${trace_util_1.SPAN_NAME_RUN_QUERY}: Retryable Error.`, {
                            'error.message': err.message,
                        });
                        // Enqueue a "no-op" write into the stream and wait for it to be
                        // read by the downstream consumer. This ensures that all enqueued
                        // results in the stream are consumed, which will give us an accurate
                        // value for `lastReceivedDocument`.
                        stream.write(constants_1.NOOP_MESSAGE, () => {
                            if (this._hasRetryTimedOut(methodName, startTime)) {
                                (0, logger_1.logger)('QueryUtil._stream', tag, 'Query failed with retryable stream error but the total retry timeout has exceeded.');
                                stream.destroy(err);
                                streamActive.resolve(/* active= */ false);
                            }
                            else if (lastReceivedDocument && retryWithCursor) {
                                if (query instanceof vector_query_1.VectorQuery) {
                                    throw new Error('Unimplemented: Vector query does not support cursors yet.');
                                }
                                (0, logger_1.logger)('Query._stream', tag, 'Query failed with retryable stream error and progress was made receiving ' +
                                    'documents, so the stream is being retried.');
                                isRetryRequestWithCursor = true;
                                // Restart the query but use the last document we received as
                                // the query cursor. Note that we do not use backoff here. The
                                // call to `requestStream()` will backoff should the restart
                                // fail before delivering any results.
                                let newQuery;
                                if (!this._queryOptions.limit) {
                                    newQuery = query;
                                }
                                else {
                                    const newLimit = this._queryOptions.limit - numDocumentsReceived;
                                    if (this._queryOptions.limitType === undefined ||
                                        this._queryOptions.limitType === types_1.LimitType.First) {
                                        newQuery = query.limit(newLimit);
                                    }
                                    else {
                                        newQuery = query.limitToLast(newLimit);
                                    }
                                }
                                if (this._queryOptions.requireConsistency) {
                                    request = newQuery
                                        .startAfter(lastReceivedDocument)
                                        .toProto(lastReceivedDocument.readTime);
                                }
                                else {
                                    request = newQuery
                                        .startAfter(lastReceivedDocument)
                                        .toProto();
                                }
                                // Set lastReceivedDocument to null before each retry attempt to ensure the retry makes progress
                                lastReceivedDocument = null;
                                streamActive.resolve(/* active= */ true);
                            }
                            else {
                                (0, logger_1.logger)('QueryUtil._stream', tag, `Query failed with retryable stream error however either retryWithCursor="${retryWithCursor}", or ` +
                                    'no progress was made receiving documents, so the stream is being closed.');
                                stream.destroy(err);
                                streamActive.resolve(/* active= */ false);
                            }
                        });
                    }
                    else {
                        (0, logger_1.logger)('QueryUtil._stream', tag, 'Query failed with stream error:', err);
                        this._firestore._traceUtil
                            .currentSpan()
                            .addEvent(`${trace_util_1.SPAN_NAME_RUN_QUERY}: Error.`, {
                            'error.message': err.message,
                        });
                        stream.destroy(err);
                        streamActive.resolve(/* active= */ false);
                    }
                });
                backendStream.on('end', () => {
                    streamActive.resolve(/* active= */ false);
                });
                backendStream.resume();
                backendStream.pipe(stream);
            } while (await streamActive.promise);
        })
            .catch(e => stream.destroy(e));
        return stream;
    }
}
exports.QueryUtil = QueryUtil;
//# sourceMappingURL=query-util.js.map