import { Float } from "../arrow";
import { EmbeddingFunction } from "./embedding_function";
export type XenovaTransformerOptions = {
    /** The wasm compatible model to use */
    model: string;
    /**
     * The wasm compatible tokenizer to use
     * If not provided, it will use the default tokenizer for the model
     */
    tokenizer?: string;
    /**
     * The number of dimensions of the embeddings
     *
     * We will attempt to infer this from the model config if not provided.
     * Since there isn't a standard way to get this information from the model,
     * you may need to manually specify this if using a model that doesn't have a 'hidden_size' in the config.
     * */
    ndims?: number;
    /** Options for the tokenizer */
    tokenizerOptions?: {
        textPair?: string | string[];
        padding?: boolean | "max_length";
        addSpecialTokens?: boolean;
        truncation?: boolean;
        maxLength?: number;
    };
};
export declare class TransformersEmbeddingFunction extends EmbeddingFunction<string, Partial<XenovaTransformerOptions>> {
    #private;
    constructor(optionsRaw?: Partial<XenovaTransformerOptions>);
    init(): Promise<void>;
    ndims(): number;
    embeddingDataType(): Float;
    computeSourceEmbeddings(data: string[]): Promise<number[][]>;
    computeQueryEmbeddings(data: string): Promise<number[]>;
}
