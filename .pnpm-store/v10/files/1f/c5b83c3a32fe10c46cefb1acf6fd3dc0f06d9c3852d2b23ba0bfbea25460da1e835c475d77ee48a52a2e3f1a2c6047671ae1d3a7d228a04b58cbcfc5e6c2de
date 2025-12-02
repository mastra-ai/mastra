export declare enum ExecutionProvider {
    CPU = "cpu",
    CUDA = "cuda",
    WebGL = "webgl",
    WASM = "wasm",
    XNNPACK = "xnnpack"
}
export declare enum EmbeddingModel {
    AllMiniLML6V2 = "fast-all-MiniLM-L6-v2",
    BGEBaseEN = "fast-bge-base-en",
    BGEBaseENV15 = "fast-bge-base-en-v1.5",
    BGESmallEN = "fast-bge-small-en",
    BGESmallENV15 = "fast-bge-small-en-v1.5",
    BGESmallZH = "fast-bge-small-zh-v1.5",
    MLE5Large = "fast-multilingual-e5-large"
}
interface InitOptions {
    model: EmbeddingModel;
    executionProviders: ExecutionProvider[];
    maxLength: number;
    cacheDir: string;
    showDownloadProgress: boolean;
}
interface ModelInfo {
    model: EmbeddingModel;
    dim: number;
    description: string;
}
declare abstract class Embedding {
    abstract listSupportedModels(): ModelInfo[];
    abstract embed(texts: string[], batchSize?: number): AsyncGenerator<number[][], void, unknown>;
    abstract passageEmbed(texts: string[], batchSize: number): AsyncGenerator<number[][], void, unknown>;
    abstract queryEmbed(query: string): Promise<number[]>;
}
export declare class FlagEmbedding extends Embedding {
    private tokenizer;
    private session;
    private model;
    private constructor();
    static init({ model, executionProviders, maxLength, cacheDir, showDownloadProgress, }?: Partial<InitOptions>): Promise<FlagEmbedding>;
    private static loadTokenizer;
    private static downloadFileFromGCS;
    private static decompressToCache;
    private static retrieveModel;
    embed(textStrings: string[], batchSize?: number): AsyncGenerator<number[][], void, unknown>;
    passageEmbed(texts: string[], batchSize?: number): AsyncGenerator<number[][], void, unknown>;
    queryEmbed(query: string): Promise<number[]>;
    listSupportedModels(): ModelInfo[];
}
export {};
//# sourceMappingURL=fastembed.d.ts.map