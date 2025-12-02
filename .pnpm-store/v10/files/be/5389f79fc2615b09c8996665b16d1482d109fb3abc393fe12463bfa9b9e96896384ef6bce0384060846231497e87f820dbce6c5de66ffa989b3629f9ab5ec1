"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlagEmbedding = exports.EmbeddingModel = exports.ExecutionProvider = void 0;
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const path_1 = __importDefault(require("path"));
const progress_1 = __importDefault(require("progress"));
const tar_1 = __importDefault(require("tar"));
const tokenizers_1 = require("@anush008/tokenizers");
const ort = __importStar(require("onnxruntime-node"));
var ExecutionProvider;
(function (ExecutionProvider) {
    ExecutionProvider["CPU"] = "cpu";
    ExecutionProvider["CUDA"] = "cuda";
    ExecutionProvider["WebGL"] = "webgl";
    ExecutionProvider["WASM"] = "wasm";
    ExecutionProvider["XNNPACK"] = "xnnpack";
})(ExecutionProvider || (exports.ExecutionProvider = ExecutionProvider = {}));
var EmbeddingModel;
(function (EmbeddingModel) {
    EmbeddingModel["AllMiniLML6V2"] = "fast-all-MiniLM-L6-v2";
    EmbeddingModel["BGEBaseEN"] = "fast-bge-base-en";
    EmbeddingModel["BGEBaseENV15"] = "fast-bge-base-en-v1.5";
    EmbeddingModel["BGESmallEN"] = "fast-bge-small-en";
    EmbeddingModel["BGESmallENV15"] = "fast-bge-small-en-v1.5";
    EmbeddingModel["BGESmallZH"] = "fast-bge-small-zh-v1.5";
    EmbeddingModel["MLE5Large"] = "fast-multilingual-e5-large";
})(EmbeddingModel || (exports.EmbeddingModel = EmbeddingModel = {}));
function normalize(v) {
    const norm = Math.sqrt(v.reduce((acc, val) => acc + val * val, 0));
    const epsilon = 1e-12;
    return v.map((val) => val / Math.max(norm, epsilon));
}
function getEmbeddings(data, dimensions) {
    const [x, y, z] = dimensions;
    return new Array(x).fill(undefined).map((_, index) => {
        const startIndex = index * y * z;
        const endIndex = startIndex + z;
        return data.slice(startIndex, endIndex);
    });
}
// Remove attention pooling
// Ref: https://github.com/qdrant/fastembed/commit/a335c8898f11042fdb311fce2dab3acf50c23011
// function create3DArray(
//   inputArray: number[],
//   dimensions: number[]
// ): number[][][] {
//   const totalElements = dimensions.reduce((acc, val) => acc * val, 1);
//   if (inputArray.length !== totalElements) {
//     throw new Error(
//       "Input array length does not match the specified dimensions."
//     );
//   }
//   const resultArray = Array.from({ length: dimensions[0] }, (_, i) =>
//     Array.from({ length: dimensions[1] }, (_, j) =>
//       Array.from(
//         { length: dimensions[2] },
//         (_, k) =>
//           inputArray[i * dimensions[1] * dimensions[2] + j * dimensions[2] + k]
//       )
//     )
//   );
//   return resultArray;
// }
class Embedding {
}
class FlagEmbedding extends Embedding {
    constructor(tokenizer, session, model) {
        super();
        this.tokenizer = tokenizer;
        this.session = session;
        this.model = model;
    }
    static async init({ model = EmbeddingModel.BGESmallENV15, executionProviders = [ExecutionProvider.CPU], maxLength = 512, cacheDir = "local_cache", showDownloadProgress = true, } = {}) {
        const modelDir = await FlagEmbedding.retrieveModel(model, cacheDir, showDownloadProgress);
        const tokenizer = this.loadTokenizer(modelDir, maxLength);
        const modelPath = path_1.default.join(modelDir.toString(), model === EmbeddingModel.MLE5Large ||
            model === EmbeddingModel.AllMiniLML6V2
            ? "model.onnx"
            : "model_optimized.onnx");
        if (!fs_1.default.existsSync(modelPath)) {
            throw new Error(`Model file not found at ${modelPath}`);
        }
        const session = await ort.InferenceSession.create(modelPath, {
            executionProviders,
            graphOptimizationLevel: "all",
        });
        return new FlagEmbedding(tokenizer, session, model);
    }
    static loadTokenizer(modelDir, maxLength) {
        const tokenizerPath = path_1.default.join(modelDir.toString(), "tokenizer.json");
        if (!fs_1.default.existsSync(tokenizerPath)) {
            throw new Error(`Tokenizer file not found at ${tokenizerPath}`);
        }
        const configPath = path_1.default.join(modelDir.toString(), "config.json");
        if (!fs_1.default.existsSync(configPath)) {
            throw new Error(`Config file not found at ${configPath}`);
        }
        const config = JSON.parse(fs_1.default.readFileSync(configPath, "utf-8"));
        const tokenizerFilePath = path_1.default.join(modelDir.toString(), "tokenizer_config.json");
        if (!fs_1.default.existsSync(tokenizerFilePath)) {
            throw new Error(`Tokenizer file not found at ${tokenizerFilePath}`);
        }
        const tokenizerConfig = JSON.parse(fs_1.default.readFileSync(tokenizerFilePath, "utf-8"));
        maxLength = Math.min(maxLength, tokenizerConfig["model_max_length"]);
        const tokensMapPath = path_1.default.join(modelDir.toString(), "special_tokens_map.json");
        if (!fs_1.default.existsSync(tokensMapPath)) {
            throw new Error(`Tokens map file not found at ${tokensMapPath}`);
        }
        const tokensMap = JSON.parse(fs_1.default.readFileSync(tokensMapPath, "utf-8"));
        const tokenizer = tokenizers_1.Tokenizer.fromFile(tokenizerPath);
        tokenizer.setTruncation(maxLength);
        tokenizer.setPadding({
            maxLength,
            padId: config["pad_token_id"],
            padToken: tokenizerConfig["pad_token"],
        });
        for (let token of Object.values(tokensMap)) {
            if (typeof token === "string") {
                tokenizer.addSpecialTokens([token]);
            }
            else if (isAddedTokenMap(token)) {
                const addedToken = new tokenizers_1.AddedToken(token["content"], true, {
                    singleWord: token["single_word"],
                    leftStrip: token["lstrip"],
                    rightStrip: token["rstrip"],
                    normalized: token["normalized"],
                });
                tokenizer.addAddedTokens([addedToken]);
            }
        }
        return tokenizer;
    }
    static async downloadFileFromGCS(outputFilePath, model, showDownloadProgress = true) {
        if (fs_1.default.existsSync(outputFilePath)) {
            return outputFilePath;
        }
        // The AllMiniLML6V2 model URL doesn't follow the same naming convention as the other models
        // So, we transform "fast-all-MiniLM-L6-v2" -> "sentence-transformers-all-MiniLM-L6-v2" in the download URL
        // The model directory name in the GCS storage remains "fast-all-MiniLM-L6-v2"
        if (model === EmbeddingModel.AllMiniLML6V2) {
            model = "sentence-transformers" + model.substring(model.indexOf("-"));
        }
        const url = `https://storage.googleapis.com/qdrant-fastembed/${model}.tar.gz`;
        const fileStream = fs_1.default.createWriteStream(outputFilePath);
        return new Promise((resolve, reject) => {
            https_1.default
                .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (response) => {
                const totalSizeInBytes = parseInt(response.headers["content-length"] || "0", 10);
                if (totalSizeInBytes === 0) {
                    console.warn(`Warning: Content-length header is missing or zero in the response from ${url}.`);
                }
                if (showDownloadProgress) {
                    const progressBar = new progress_1.default(`Downloading ${model} [:bar] :percent :etas`, {
                        complete: "=",
                        width: 20,
                        total: totalSizeInBytes,
                    });
                    response.on("data", (chunk) => {
                        progressBar.tick(chunk.length, { speed: "N/A" });
                    });
                }
                response.on("error", (error) => {
                    reject(error);
                });
                response.pipe(fileStream);
                fileStream.on("finish", () => {
                    fileStream.close();
                    resolve(outputFilePath);
                });
                fileStream.on("error", (error) => {
                    reject(error);
                });
            })
                .on("error", (error) => {
                fs_1.default.unlink(outputFilePath, () => {
                    reject(error);
                });
            });
        });
    }
    static async decompressToCache(targzPath, cacheDir) {
        // Implementation for decompressing a .tar.gz file to a cache directory
        if (path_1.default.extname(targzPath.toString()) === ".gz") {
            await tar_1.default.x({
                file: targzPath,
                // @ts-ignore
                cwd: cacheDir,
            });
        }
        else {
            throw new Error(`Unsupported file extension: ${targzPath}`);
        }
    }
    static async retrieveModel(model, cacheDir, showDownloadProgress = true) {
        if (!fs_1.default.existsSync(cacheDir)) {
            fs_1.default.mkdirSync(cacheDir, {
                mode: 0o777,
            });
        }
        const modelDir = path_1.default.join(cacheDir.toString(), model);
        if (fs_1.default.existsSync(modelDir)) {
            return modelDir;
        }
        const modelTarGz = path_1.default.join(cacheDir.toString(), `${model}.tar.gz`);
        await this.downloadFileFromGCS(modelTarGz, model, showDownloadProgress);
        await this.decompressToCache(modelTarGz, cacheDir);
        fs_1.default.unlinkSync(modelTarGz);
        return modelDir;
    }
    async *embed(textStrings, batchSize = 256) {
        for (let i = 0; i < textStrings.length; i += batchSize) {
            const batchTexts = textStrings.slice(i, i + batchSize);
            const encodedTexts = await Promise.all(batchTexts.map((textString) => this.tokenizer.encode(textString)));
            const idsArray = [];
            const maskArray = [];
            const typeIdsArray = [];
            encodedTexts.forEach((text) => {
                const ids = text.getIds().map(BigInt);
                const mask = text.getAttentionMask().map(BigInt);
                const typeIds = text.getTypeIds().map(BigInt);
                idsArray.push(ids);
                maskArray.push(mask);
                typeIdsArray.push(typeIds);
            });
            const maxLength = idsArray[0].length;
            const batchInputIds = new ort.Tensor("int64", idsArray.flat(), [batchTexts.length, maxLength]);
            const batchAttentionMask = new ort.Tensor("int64", maskArray.flat(), [batchTexts.length, maxLength]);
            const batchTokenTypeId = new ort.Tensor("int64", typeIdsArray.flat(), [batchTexts.length, maxLength]);
            const inputs = {
                input_ids: batchInputIds,
                attention_mask: batchAttentionMask,
                token_type_ids: batchTokenTypeId,
            };
            // Exclude token_type_ids for MLE5Large
            if (this.model === EmbeddingModel.MLE5Large) {
                delete inputs.token_type_ids;
            }
            const output = await this.session.run(inputs);
            // Remove attention pooling
            // Ref: https://github.com/qdrant/fastembed/commit/a335c8898f11042fdb311fce2dab3acf50c23011
            // const lastHiddenState: number[][][] = create3DArray(
            //   output.last_hidden_state.data as unknown[] as number[],
            //   output.last_hidden_state.dims as number[]
            // );
            // const embeddings = lastHiddenState.map((layer, layerIdx) => {
            //   const weightedSum = layer.reduce((acc, tokenEmbedding, idx) => {
            //     const attentionWeight = maskArray[layerIdx][idx];
            //     return acc.map(
            //       (val, i) => val + tokenEmbedding[i] * Number(attentionWeight)
            //     );
            //   }, new Array(layer[0].length).fill(0));
            //   const inputMaskSum = maskArray[layerIdx].reduce(
            //     (acc, attentionWeight) => acc + Number(attentionWeight),
            //     0
            //   );
            //   return weightedSum.map((val) => val / Math.max(inputMaskSum, 1e-9));
            // });
            // const embeddings = lastHiddenState.map((sentence) => sentence[0]);
            const embeddings = getEmbeddings(output.last_hidden_state.data, output.last_hidden_state.dims);
            yield embeddings.map(normalize);
        }
    }
    passageEmbed(texts, batchSize = 256) {
        texts = texts.map((text) => `passage: ${text}`);
        return this.embed(texts, batchSize);
    }
    async queryEmbed(query) {
        return (await this.embed([`query: ${query}`]).next()).value[0];
    }
    listSupportedModels() {
        return [
            {
                model: EmbeddingModel.BGESmallEN,
                dim: 384,
                description: "Fast English model",
            },
            {
                model: EmbeddingModel.BGESmallENV15,
                dim: 384,
                description: "v1.5 release of the fast, default English model",
            },
            {
                model: EmbeddingModel.BGEBaseEN,
                dim: 768,
                description: "Base English model",
            },
            {
                model: EmbeddingModel.BGEBaseENV15,
                dim: 768,
                description: "v1.5 release of Base English model",
            },
            {
                model: EmbeddingModel.BGESmallZH,
                dim: 512,
                description: "v1.5 release of the fast, Chinese model",
            },
            {
                model: EmbeddingModel.AllMiniLML6V2,
                dim: 384,
                description: "Sentence Transformer model, MiniLM-L6-v2",
            },
            {
                model: EmbeddingModel.MLE5Large,
                dim: 1024,
                description: "Multilingual model, e5-large. Recommend using this model for non-English languages",
            },
        ];
    }
}
exports.FlagEmbedding = FlagEmbedding;
function isAddedTokenMap(token) {
    return (typeof token === "object" &&
        token !== null &&
        "token" in token &&
        "single_word" in token &&
        "rstrip" in token &&
        "lstrip" in token &&
        "normalized" in token);
}
//# sourceMappingURL=fastembed.js.map