import { isDeepgramError } from "../lib/errors";
import {
  DeepgramResponse,
  GetModelResponse,
  GetModelsResponse,
  GetModelsSchema,
} from "../lib/types";
import { AbstractRestClient } from "./AbstractRestClient";

/**
 * Represents a REST client for interacting with the Deepgram API.
 *
 * The `ModelsRestClient` class provides methods for interacting with the Deepgram API to retrieve information about available models.
 * @extends AbstractRestClient
 */
export class ModelsRestClient extends AbstractRestClient {
  public namespace: string = "models";

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
  async getAll(
    endpoint = ":version/models",
    options: GetModelsSchema = {}
  ): Promise<DeepgramResponse<GetModelsResponse>> {
    try {
      const requestUrl = this.getRequestUrl(endpoint, {}, options);
      const result: GetModelsResponse = await this.get(requestUrl).then((result) => result.json());

      return { result, error: null };
    } catch (error) {
      if (isDeepgramError(error)) {
        return { result: null, error };
      }

      throw error;
    }
  }

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
  async getModel(
    modelId: string,
    endpoint = ":version/models/:modelId"
  ): Promise<DeepgramResponse<GetModelResponse>> {
    try {
      const requestUrl = this.getRequestUrl(endpoint, { modelId });
      const result: GetModelResponse = await this.get(requestUrl).then((result) => result.json());

      return { result, error: null };
    } catch (error) {
      if (isDeepgramError(error)) {
        return { result: null, error };
      }

      throw error;
    }
  }
}
