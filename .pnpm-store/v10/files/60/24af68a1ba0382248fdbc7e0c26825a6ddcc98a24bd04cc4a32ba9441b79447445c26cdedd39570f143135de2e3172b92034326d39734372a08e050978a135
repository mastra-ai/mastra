"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextEmbeddingFunction = exports.EmbeddingFunction = void 0;
require("reflect-metadata");
const arrow_1 = require("../arrow");
const sanitize_1 = require("../sanitize");
const registry_1 = require("./registry");
/**
 * An embedding function that automatically creates vector representation for a given column.
 *
 * It's important subclasses pass the **original** options to the super constructor
 * and then pass those options to `resolveVariables` to resolve any variables before
 * using them.
 *
 * @example
 * ```ts
 * class MyEmbeddingFunction extends EmbeddingFunction {
 *   constructor(options: {model: string, timeout: number}) {
 *     super(optionsRaw);
 *     const options = this.resolveVariables(optionsRaw);
 *     this.model = options.model;
 *     this.timeout = options.timeout;
 *   }
 * }
 * ```
 */
class EmbeddingFunction {
    /**
     * @ignore
     *  This is only used for associating the options type with the class for type checking
     */
    // biome-ignore lint/style/useNamingConvention: we want to keep the name as it is
    TOptions;
    #config;
    /**
     * Get the original arguments to the constructor, to serialize them so they
     * can be used to recreate the embedding function later.
     */
    // biome-ignore lint/suspicious/noExplicitAny :
    toJSON() {
        return JSON.parse(JSON.stringify(this.#config));
    }
    constructor() {
        this.#config = {};
    }
    /**
     * Provide a list of keys in the function options that should be treated as
     * sensitive. If users pass raw values for these keys, they will be rejected.
     */
    getSensitiveKeys() {
        return [];
    }
    /**
     * Apply variables to the config.
     */
    resolveVariables(config) {
        this.#config = config;
        const registry = (0, registry_1.getRegistry)();
        const newConfig = { ...config };
        for (const [key_, value] of Object.entries(newConfig)) {
            if (this.getSensitiveKeys().includes(key_) &&
                !value.startsWith("$var:")) {
                throw new Error(`The key "${key_}" is sensitive and cannot be set directly. Please use the $var: syntax to set it.`);
            }
            // Makes TS happy (https://stackoverflow.com/a/78391854)
            const key = key_;
            if (typeof value === "string" && value.startsWith("$var:")) {
                const [name, defaultValue] = value.slice(5).split(":", 2);
                const variableValue = registry.getVar(name);
                if (!variableValue) {
                    if (defaultValue) {
                        // biome-ignore lint/suspicious/noExplicitAny:
                        newConfig[key] = defaultValue;
                    }
                    else {
                        throw new Error(`Variable "${name}" not found`);
                    }
                }
                else {
                    // biome-ignore lint/suspicious/noExplicitAny:
                    newConfig[key] = variableValue;
                }
            }
        }
        return newConfig;
    }
    /**
     * sourceField is used in combination with `LanceSchema` to provide a declarative data model
     *
     * @param optionsOrDatatype - The options for the field or the datatype
     *
     * @see {@link LanceSchema}
     */
    sourceField(optionsOrDatatype) {
        let datatype = "datatype" in optionsOrDatatype
            ? optionsOrDatatype.datatype
            : optionsOrDatatype;
        if (!datatype) {
            throw new Error("Datatype is required");
        }
        datatype = (0, sanitize_1.sanitizeType)(datatype);
        const metadata = new Map();
        metadata.set("source_column_for", this);
        return [datatype, metadata];
    }
    /**
     * vectorField is used in combination with `LanceSchema` to provide a declarative data model
     *
     * @param optionsOrDatatype - The options for the field
     *
     * @see {@link LanceSchema}
     */
    vectorField(optionsOrDatatype) {
        let dtype;
        let vectorType;
        let dims = this.ndims();
        // `func.vectorField(new Float32())`
        if (optionsOrDatatype === undefined) {
            dtype = new arrow_1.Float32();
        }
        else if (!("datatype" in optionsOrDatatype)) {
            dtype = (0, sanitize_1.sanitizeType)(optionsOrDatatype);
        }
        else {
            // `func.vectorField({
            //  datatype: new Float32(),
            //  dims: 10
            // })`
            dims = dims ?? optionsOrDatatype?.dims;
            dtype = (0, sanitize_1.sanitizeType)(optionsOrDatatype?.datatype);
        }
        if (dtype !== undefined) {
            // `func.vectorField(new FixedSizeList(dims, new Field("item", new Float32(), true)))`
            // or `func.vectorField({datatype: new FixedSizeList(dims, new Field("item", new Float32(), true))})`
            if ((0, arrow_1.isFixedSizeList)(dtype)) {
                vectorType = dtype;
                // `func.vectorField(new Float32())`
                // or `func.vectorField({datatype: new Float32()})`
            }
            else if ((0, arrow_1.isFloat)(dtype)) {
                // No `ndims` impl and no `{dims: n}` provided;
                if (dims === undefined) {
                    throw new Error("ndims is required for vector field");
                }
                vectorType = (0, arrow_1.newVectorType)(dims, dtype);
            }
            else {
                throw new Error("Expected FixedSizeList or Float as datatype for vector field");
            }
        }
        else {
            if (dims === undefined) {
                throw new Error("ndims is required for vector field");
            }
            vectorType = new arrow_1.FixedSizeList(dims, new arrow_1.Field("item", new arrow_1.Float32(), true));
        }
        const metadata = new Map();
        metadata.set("vector_column_for", this);
        return [vectorType, metadata];
    }
    /** The number of dimensions of the embeddings */
    ndims() {
        return undefined;
    }
    /**
    Compute the embeddings for a single query
   */
    async computeQueryEmbeddings(data) {
        return this.computeSourceEmbeddings([data]).then((embeddings) => embeddings[0]);
    }
}
exports.EmbeddingFunction = EmbeddingFunction;
/**
 * an abstract class for implementing embedding functions that take text as input
 */
class TextEmbeddingFunction extends EmbeddingFunction {
    async computeQueryEmbeddings(data) {
        return this.generateEmbeddings([data]).then((data) => data[0]);
    }
    embeddingDataType() {
        return new arrow_1.Float32();
    }
    sourceField() {
        return super.sourceField(new arrow_1.Utf8());
    }
    computeSourceEmbeddings(data) {
        return this.generateEmbeddings(data);
    }
}
exports.TextEmbeddingFunction = TextEmbeddingFunction;
