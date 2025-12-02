var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { isDeepgramError } from "../lib/errors";
import { AbstractRestClient } from "./AbstractRestClient";
/**
 * Represents a REST client for interacting with the Deepgram API.
 *
 * The `ModelsRestClient` class provides methods for interacting with the Deepgram API to retrieve information about available models.
 * @extends AbstractRestClient
 */
export class ModelsRestClient extends AbstractRestClient {
    constructor() {
        super(...arguments);
        this.namespace = "models";
    }
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
    getAll(endpoint = ":version/models", options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, {}, options);
                const result = yield this.get(requestUrl).then((result) => result.json());
                return { result, error: null };
            }
            catch (error) {
                if (isDeepgramError(error)) {
                    return { result: null, error };
                }
                throw error;
            }
        });
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
    getModel(modelId, endpoint = ":version/models/:modelId") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { modelId });
                const result = yield this.get(requestUrl).then((result) => result.json());
                return { result, error: null };
            }
            catch (error) {
                if (isDeepgramError(error)) {
                    return { result: null, error };
                }
                throw error;
            }
        });
    }
}
//# sourceMappingURL=ModelsRestClient.js.map