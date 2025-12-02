"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformersEmbeddingFunction = void 0;
const arrow_1 = require("../arrow");
const embedding_function_1 = require("./embedding_function");
const registry_1 = require("./registry");
let TransformersEmbeddingFunction = class TransformersEmbeddingFunction extends embedding_function_1.EmbeddingFunction {
    #model;
    #tokenizer;
    #modelName;
    #initialized = false;
    #tokenizerOptions;
    #ndims;
    constructor(optionsRaw = {
        model: "Xenova/all-MiniLM-L6-v2",
    }) {
        super();
        const options = this.resolveVariables(optionsRaw);
        const modelName = options?.model ?? "Xenova/all-MiniLM-L6-v2";
        this.#tokenizerOptions = {
            padding: true,
            ...options.tokenizerOptions,
        };
        this.#ndims = options.ndims;
        this.#modelName = modelName;
    }
    async init() {
        let transformers;
        try {
            // SAFETY:
            // since typescript transpiles `import` to `require`, we need to do this in an unsafe way
            // We can't use `require` because `@huggingface/transformers` is an ESM module
            // and we can't use `import` directly because typescript will transpile it to `require`.
            // and we want to remain compatible with both ESM and CJS modules
            // so we use `eval` to bypass typescript for this specific import.
            transformers = await eval('import("@huggingface/transformers")');
        }
        catch (e) {
            throw new Error(`error loading @huggingface/transformers\nReason: ${e}`);
        }
        try {
            this.#model = await transformers.AutoModel.from_pretrained(this.#modelName, { dtype: "fp32" });
        }
        catch (e) {
            throw new Error(`error loading model ${this.#modelName}. Make sure you are using a wasm compatible model.\nReason: ${e}`);
        }
        try {
            this.#tokenizer = await transformers.AutoTokenizer.from_pretrained(this.#modelName);
        }
        catch (e) {
            throw new Error(`error loading tokenizer for ${this.#modelName}. Make sure you are using a wasm compatible model:\nReason: ${e}`);
        }
        this.#initialized = true;
    }
    ndims() {
        if (this.#ndims) {
            return this.#ndims;
        }
        else {
            const config = this.#model.config;
            // biome-ignore lint/style/useNamingConvention: we don't control this name.
            const ndims = config.hidden_size;
            if (!ndims) {
                throw new Error("hidden_size not found in model config, you may need to manually specify the embedding dimensions. ");
            }
            return ndims;
        }
    }
    embeddingDataType() {
        return new arrow_1.Float32();
    }
    async computeSourceEmbeddings(data) {
        // this should only happen if the user is trying to use the function directly.
        // Anything going through the registry should already be initialized.
        if (!this.#initialized) {
            return Promise.reject(new Error("something went wrong: embedding function not initialized. Please call init()"));
        }
        const tokenizer = this.#tokenizer;
        const model = this.#model;
        const inputs = await tokenizer(data, this.#tokenizerOptions);
        let tokens = await model.forward(inputs);
        tokens = tokens[Object.keys(tokens)[0]];
        const [nItems, nTokens] = tokens.dims;
        tokens = tensorDiv(tokens.sum(1), nTokens);
        // TODO: support other data types
        const tokenData = tokens.data;
        const stride = this.ndims();
        const embeddings = [];
        for (let i = 0; i < nItems; i++) {
            const start = i * stride;
            const end = start + stride;
            const slice = tokenData.slice(start, end);
            embeddings.push(Array.from(slice)); // TODO: Avoid copy here
        }
        return embeddings;
    }
    async computeQueryEmbeddings(data) {
        return (await this.computeSourceEmbeddings([data]))[0];
    }
};
exports.TransformersEmbeddingFunction = TransformersEmbeddingFunction;
exports.TransformersEmbeddingFunction = TransformersEmbeddingFunction = __decorate([
    (0, registry_1.register)("huggingface"),
    __metadata("design:paramtypes", [Object])
], TransformersEmbeddingFunction);
const tensorDiv = (src, divBy) => {
    for (let i = 0; i < src.data.length; ++i) {
        src.data[i] /= divBy;
    }
    return src;
};
