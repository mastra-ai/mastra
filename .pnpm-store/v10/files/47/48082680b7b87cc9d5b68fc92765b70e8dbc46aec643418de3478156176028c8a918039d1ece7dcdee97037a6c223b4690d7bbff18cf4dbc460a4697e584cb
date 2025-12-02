"use strict";
// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BundleBuilder = void 0;
const document_1 = require("./document");
const query_snapshot_1 = require("./reference/query-snapshot");
const timestamp_1 = require("./timestamp");
const validate_1 = require("./validate");
const BUNDLE_VERSION = 1;
/**
 * Builds a Firestore data bundle with results from the given document and query snapshots.
 */
class BundleBuilder {
    constructor(bundleId) {
        this.bundleId = bundleId;
        // Resulting documents for the bundle, keyed by full document path.
        this.documents = new Map();
        // Named queries saved in the bundle, keyed by query name.
        this.namedQueries = new Map();
        // The latest read time among all bundled documents and queries.
        this.latestReadTime = new timestamp_1.Timestamp(0, 0);
    }
    /**
     * Adds a Firestore document snapshot or query snapshot to the bundle.
     * Both the documents data and the query read time will be included in the bundle.
     *
     * @param {DocumentSnapshot | string} documentOrName A document snapshot to add or a name of a query.
     * @param {Query=} querySnapshot A query snapshot to add to the bundle, if provided.
     * @returns {BundleBuilder} This instance.
     *
     * @example
     * ```
     * const bundle = firestore.bundle('data-bundle');
     * const docSnapshot = await firestore.doc('abc/123').get();
     * const querySnapshot = await firestore.collection('coll').get();
     *
     * const bundleBuffer = bundle.add(docSnapshot) // Add a document
     *                            .add('coll-query', querySnapshot) // Add a named query.
     *                            .build()
     * // Save `bundleBuffer` to CDN or stream it to clients.
     * ```
     */
    add(documentOrName, querySnapshot) {
        // eslint-disable-next-line prefer-rest-params
        (0, validate_1.validateMinNumberOfArguments)('BundleBuilder.add', arguments, 1);
        // eslint-disable-next-line prefer-rest-params
        (0, validate_1.validateMaxNumberOfArguments)('BundleBuilder.add', arguments, 2);
        if (arguments.length === 1) {
            validateDocumentSnapshot('documentOrName', documentOrName);
            this.addBundledDocument(documentOrName);
        }
        else {
            (0, validate_1.validateString)('documentOrName', documentOrName);
            validateQuerySnapshot('querySnapshot', querySnapshot);
            this.addNamedQuery(documentOrName, querySnapshot);
        }
        return this;
    }
    addBundledDocument(snap, queryName) {
        const originalDocument = this.documents.get(snap.ref.path);
        const originalQueries = originalDocument === null || originalDocument === void 0 ? void 0 : originalDocument.metadata.queries;
        // Update with document built from `snap` because it is newer.
        if (!originalDocument ||
            timestamp_1.Timestamp.fromProto(originalDocument.metadata.readTime) < snap.readTime) {
            const docProto = snap.toDocumentProto();
            this.documents.set(snap.ref.path, {
                document: snap.exists ? docProto : undefined,
                metadata: {
                    name: docProto.name,
                    readTime: snap.readTime.toProto().timestampValue,
                    exists: snap.exists,
                },
            });
        }
        // Update `queries` to include both original and `queryName`.
        const newDocument = this.documents.get(snap.ref.path);
        newDocument.metadata.queries = originalQueries || [];
        if (queryName) {
            newDocument.metadata.queries.push(queryName);
        }
        if (snap.readTime > this.latestReadTime) {
            this.latestReadTime = snap.readTime;
        }
    }
    addNamedQuery(name, querySnap) {
        if (this.namedQueries.has(name)) {
            throw new Error(`Query name conflict: ${name} has already been added.`);
        }
        this.namedQueries.set(name, {
            name,
            bundledQuery: querySnap.query._toBundledQuery(),
            readTime: querySnap.readTime.toProto().timestampValue,
        });
        for (const snap of querySnap.docs) {
            this.addBundledDocument(snap, name);
        }
        if (querySnap.readTime > this.latestReadTime) {
            this.latestReadTime = querySnap.readTime;
        }
    }
    /**
     * Converts a IBundleElement to a Buffer whose content is the length prefixed JSON representation
     * of the element.
     * @private
     * @internal
     */
    elementToLengthPrefixedBuffer(bundleElement) {
        // Convert to a valid proto message object then take its JSON representation.
        // This take cares of stuff like converting internal byte array fields
        // to Base64 encodings.
        // We lazy-load the Proto file to reduce cold-start times.
        const message = require('../protos/firestore_v1_proto_api')
            .firestore.BundleElement.fromObject(bundleElement)
            .toJSON();
        const buffer = Buffer.from(JSON.stringify(message), 'utf-8');
        const lengthBuffer = Buffer.from(buffer.length.toString());
        return Buffer.concat([lengthBuffer, buffer]);
    }
    build() {
        let bundleBuffer = Buffer.alloc(0);
        for (const namedQuery of this.namedQueries.values()) {
            bundleBuffer = Buffer.concat([
                bundleBuffer,
                this.elementToLengthPrefixedBuffer({ namedQuery }),
            ]);
        }
        for (const bundledDocument of this.documents.values()) {
            const documentMetadata = bundledDocument.metadata;
            bundleBuffer = Buffer.concat([
                bundleBuffer,
                this.elementToLengthPrefixedBuffer({ documentMetadata }),
            ]);
            // Write to the bundle if document exists.
            const document = bundledDocument.document;
            if (document) {
                bundleBuffer = Buffer.concat([
                    bundleBuffer,
                    this.elementToLengthPrefixedBuffer({ document }),
                ]);
            }
        }
        const metadata = {
            id: this.bundleId,
            createTime: this.latestReadTime.toProto().timestampValue,
            version: BUNDLE_VERSION,
            totalDocuments: this.documents.size,
            totalBytes: bundleBuffer.length,
        };
        // Prepends the metadata element to the bundleBuffer: `bundleBuffer` is the second argument to `Buffer.concat`.
        bundleBuffer = Buffer.concat([
            this.elementToLengthPrefixedBuffer({ metadata }),
            bundleBuffer,
        ]);
        return bundleBuffer;
    }
}
exports.BundleBuilder = BundleBuilder;
/**
 * Convenient class to hold both the metadata and the actual content of a document to be bundled.
 * @private
 * @internal
 */
class BundledDocument {
    constructor(metadata, document) {
        this.metadata = metadata;
        this.document = document;
    }
}
/**
 * Validates that 'value' is DocumentSnapshot.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 */
function validateDocumentSnapshot(arg, value) {
    if (!(value instanceof document_1.DocumentSnapshot)) {
        throw new Error((0, validate_1.invalidArgumentMessage)(arg, 'DocumentSnapshot'));
    }
}
/**
 * Validates that 'value' is QuerySnapshot.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 */
function validateQuerySnapshot(arg, value) {
    if (!(value instanceof query_snapshot_1.QuerySnapshot)) {
        throw new Error((0, validate_1.invalidArgumentMessage)(arg, 'QuerySnapshot'));
    }
}
//# sourceMappingURL=bundle.js.map