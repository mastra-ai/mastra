import { Embedding, EmbeddingsList as OpenAPIEmbeddingsList, EmbeddingsListUsage } from '../pinecone-generated-ts-fetch/control';
export declare class EmbeddingsList extends Array<Embedding> implements OpenAPIEmbeddingsList {
    model?: string;
    data: Array<Embedding>;
    usage?: EmbeddingsListUsage;
    constructor(model?: string, data?: Array<Embedding>, usage?: EmbeddingsListUsage);
    toString(): string;
    toJSON(): any;
    get(index: number): Embedding;
    indexOf(element: Embedding): number;
    truncateValuesForDisplay(values: number[]): any[];
    truncateDataForDisplay(): Array<any>;
}
