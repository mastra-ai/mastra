/*!
 * Copyright 2021 Google LLC. All Rights Reserved.
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
import { DocumentSnapshot } from './document';
import { DocumentReference } from './reference/document-reference';
import { FieldPath } from './path';
import { google } from '../protos/firestore_v1_proto_api';
import { Firestore } from './index';
import { Timestamp } from './timestamp';
import { DocumentData } from '@google-cloud/firestore';
import api = google.firestore.v1;
interface BatchGetResponse<AppModelType, DbModelType extends DocumentData> {
    result: Array<DocumentSnapshot<AppModelType, DbModelType>>;
    /**
     * The transaction that was started as part of this request. Will only be if
     * `DocumentReader.transactionIdOrNewTransaction` was `api.ITransactionOptions`.
     */
    transaction?: Uint8Array;
}
/**
 * A wrapper around BatchGetDocumentsRequest that retries request upon stream
 * failure and returns ordered results.
 *
 * @private
 * @internal
 */
export declare class DocumentReader<AppModelType, DbModelType extends DocumentData> {
    private readonly firestore;
    private readonly allDocuments;
    private readonly fieldMask?;
    private readonly transactionOrReadTime?;
    private readonly outstandingDocuments;
    private readonly retrievedDocuments;
    private retrievedTransactionId?;
    /**
     * Creates a new DocumentReader that fetches the provided documents (via
     * `get()`).
     *
     * @param firestore The Firestore instance to use.
     * @param allDocuments The documents to get.
     * @param fieldMask An optional field mask to apply to this read
     * @param transactionOrReadTime An optional transaction ID to use for this
     * read or options for beginning a new transaction with this read
     */
    constructor(firestore: Firestore, allDocuments: ReadonlyArray<DocumentReference<AppModelType, DbModelType>>, fieldMask?: FieldPath[] | undefined, transactionOrReadTime?: (Uint8Array | api.ITransactionOptions | Timestamp) | undefined);
    /**
     * Invokes the BatchGetDocuments RPC and returns the results as an array of
     * documents.
     *
     * @param requestTag A unique client-assigned identifier for this request.
     */
    get(requestTag: string): Promise<Array<DocumentSnapshot<AppModelType, DbModelType>>>;
    /**
     * Invokes the BatchGetDocuments RPC and returns the results with transaction
     * metadata.
     *
     * @param requestTag A unique client-assigned identifier for this request.
     */
    _get(requestTag: string): Promise<BatchGetResponse<AppModelType, DbModelType>>;
    private fetchDocuments;
}
export {};
