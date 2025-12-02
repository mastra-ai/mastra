import type { EmbeddingCreateParams } from "openai/resources/index";
import { Float } from "../arrow";
import { EmbeddingFunction } from "./embedding_function";
export type OpenAIOptions = {
    apiKey: string;
    model: EmbeddingCreateParams["model"];
};
export declare class OpenAIEmbeddingFunction extends EmbeddingFunction<string, Partial<OpenAIOptions>> {
    #private;
    constructor(optionsRaw?: Partial<OpenAIOptions>);
    protected getSensitiveKeys(): string[];
    ndims(): number;
    embeddingDataType(): Float;
    computeSourceEmbeddings(data: string[]): Promise<number[][]>;
    computeQueryEmbeddings(data: string): Promise<number[]>;
}
