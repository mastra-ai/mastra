"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextEmbeddingFunction = exports.EmbeddingFunction = void 0;
exports.LanceSchema = LanceSchema;
const arrow_1 = require("../arrow");
const sanitize_1 = require("../sanitize");
const registry_1 = require("./registry");
var embedding_function_1 = require("./embedding_function");
Object.defineProperty(exports, "EmbeddingFunction", { enumerable: true, get: function () { return embedding_function_1.EmbeddingFunction; } });
Object.defineProperty(exports, "TextEmbeddingFunction", { enumerable: true, get: function () { return embedding_function_1.TextEmbeddingFunction; } });
__exportStar(require("./registry"), exports);
/**
 * Create a schema with embedding functions.
 *
 * @param fields
 * @returns Schema
 * @example
 * ```ts
 * class MyEmbeddingFunction extends EmbeddingFunction {
 * // ...
 * }
 * const func = new MyEmbeddingFunction();
 * const schema = LanceSchema({
 *   id: new Int32(),
 *   text: func.sourceField(new Utf8()),
 *   vector: func.vectorField(),
 *   // optional: specify the datatype and/or dimensions
 *   vector2: func.vectorField({ datatype: new Float32(), dims: 3}),
 * });
 *
 * const table = await db.createTable("my_table", data, { schema });
 * ```
 */
function LanceSchema(fields) {
    const arrowFields = [];
    const embeddingFunctions = new Map();
    Object.entries(fields).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            const [dtype, metadata] = value;
            arrowFields.push(new arrow_1.Field(key, (0, sanitize_1.sanitizeType)(dtype), true));
            parseEmbeddingFunctions(embeddingFunctions, key, metadata);
        }
        else {
            arrowFields.push(new arrow_1.Field(key, (0, sanitize_1.sanitizeType)(value), true));
        }
    });
    const registry = (0, registry_1.getRegistry)();
    const metadata = registry.getTableMetadata(Array.from(embeddingFunctions.values()));
    const schema = new arrow_1.Schema(arrowFields, metadata);
    return schema;
}
function parseEmbeddingFunctions(embeddingFunctions, key, metadata) {
    if (metadata.has("source_column_for")) {
        const embedFunction = metadata.get("source_column_for");
        const current = embeddingFunctions.get(embedFunction);
        if (current !== undefined) {
            embeddingFunctions.set(embedFunction, {
                ...current,
                sourceColumn: key,
            });
        }
        else {
            embeddingFunctions.set(embedFunction, {
                sourceColumn: key,
                function: embedFunction,
            });
        }
    }
    else if (metadata.has("vector_column_for")) {
        const embedFunction = metadata.get("vector_column_for");
        const current = embeddingFunctions.get(embedFunction);
        if (current !== undefined) {
            embeddingFunctions.set(embedFunction, {
                ...current,
                vectorColumn: key,
            });
        }
        else {
            embeddingFunctions.set(embedFunction, {
                vectorColumn: key,
                function: embedFunction,
            });
        }
    }
}
