import { EmbedRequestInputsInner, EmbedRequestParameters, InferenceApi } from '../pinecone-generated-ts-fetch/control';
import { EmbeddingsList } from '../models';
export declare class Inference {
    _inferenceApi: InferenceApi;
    constructor(inferenceApi: InferenceApi);
    _formatInputs(data: Array<string>): Array<EmbedRequestInputsInner>;
    _formatParams(parameters: Record<string, string>): EmbedRequestParameters;
    embed(model: string, inputs: Array<string>, params: Record<string, string>): Promise<EmbeddingsList>;
}
