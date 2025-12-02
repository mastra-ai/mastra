import { DeepgramResponse, GetModelResponse, GetModelsResponse, GetModelsSchema } from "../lib/types";
import { AbstractRestClient } from "./AbstractRestClient";
/**
 * Represents a REST client for interacting with the Deepgram API.
 *
 * The `ModelsRestClient` class provides methods for interacting with the Deepgram API to retrieve information about available models.
 * @extends AbstractRestClient
 */
export declare class ModelsRestClient extends AbstractRestClient {
    namespace: string;
    /**
     * Retrieves a list of all available models.
     *
     * @param endpoint - (optional) The endpoint to request.
     * @returns A promise that resolves with the response from the Deepgram API.
     * @example
     * ```typescript
     * import { createClient } from "@deepgram/sdk";
     *
     * const deepgram = createClient(DEEPGRAM_API_KEY);
     * const { result: models, error } = deepgram.models.getAll();
     *
     * if (error) {
     *   console.error(error);
     * } else {
     *   console.log(models);
     * }
     * ```
     */
    getAll(endpoint?: string, options?: GetModelsSchema): Promise<DeepgramResponse<GetModelsResponse>>;
    /**
     * Retrieves information about a specific model.
     *
     * @param modelId - The UUID of the model to retrieve.
     * @param endpoint - (optional) The endpoint to request.
     * @returns A promise that resolves with the response from the Deepgram API.
     * @example
     * ```typescript
     * import { createClient } from "@deepgram/sdk";
     *
     * const deepgram = createClient(DEEPGRAM_API_KEY);
     * const { result: model, error } = deepgram.models.getModel("modelId");
     *
     * if (error) {
     *   console.error(error);
     * } else {
     *   console.log(model);
     * }
     * ```
     */
    getModel(modelId: string, endpoint?: string): Promise<DeepgramResponse<GetModelResponse>>;
}
//# sourceMappingURL=ModelsRestClient.d.ts.map