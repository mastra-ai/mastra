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
exports.OpenAIEmbeddingFunction = void 0;
const arrow_1 = require("../arrow");
const embedding_function_1 = require("./embedding_function");
const registry_1 = require("./registry");
let OpenAIEmbeddingFunction = class OpenAIEmbeddingFunction extends embedding_function_1.EmbeddingFunction {
    #openai;
    #modelName;
    constructor(optionsRaw = {
        model: "text-embedding-ada-002",
    }) {
        super();
        const options = this.resolveVariables(optionsRaw);
        const openAIKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
        if (!openAIKey) {
            throw new Error("OpenAI API key is required");
        }
        const modelName = options?.model ?? "text-embedding-ada-002";
        /**
         * @type {import("openai").default}
         */
        // eslint-disable-next-line @typescript-eslint/naming-convention
        let Openai;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            Openai = require("openai");
        }
        catch {
            throw new Error("please install openai@^4.24.1 using npm install openai");
        }
        const configuration = {
            apiKey: openAIKey,
        };
        this.#openai = new Openai(configuration);
        this.#modelName = modelName;
    }
    getSensitiveKeys() {
        return ["apiKey"];
    }
    ndims() {
        switch (this.#modelName) {
            case "text-embedding-ada-002":
                return 1536;
            case "text-embedding-3-large":
                return 3072;
            case "text-embedding-3-small":
                return 1536;
            default:
                throw new Error(`Unknown model: ${this.#modelName}`);
        }
    }
    embeddingDataType() {
        return new arrow_1.Float32();
    }
    async computeSourceEmbeddings(data) {
        const response = await this.#openai.embeddings.create({
            model: this.#modelName,
            input: data,
        });
        const embeddings = [];
        for (let i = 0; i < response.data.length; i++) {
            embeddings.push(response.data[i].embedding);
        }
        return embeddings;
    }
    async computeQueryEmbeddings(data) {
        if (typeof data !== "string") {
            throw new Error("Data must be a string");
        }
        const response = await this.#openai.embeddings.create({
            model: this.#modelName,
            input: data,
        });
        return response.data[0].embedding;
    }
};
exports.OpenAIEmbeddingFunction = OpenAIEmbeddingFunction;
exports.OpenAIEmbeddingFunction = OpenAIEmbeddingFunction = __decorate([
    (0, registry_1.register)("openai"),
    __metadata("design:paramtypes", [Object])
], OpenAIEmbeddingFunction);
