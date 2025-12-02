"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnPremClient = exports.SelfHostedRestClient = void 0;
const errors_1 = require("../lib/errors");
const AbstractRestClient_1 = require("./AbstractRestClient");
/**
 * The `SelfHostedRestClient` class extends the `AbstractRestClient` class and provides methods for interacting with the Deepgram self-hosted API.
 *
 * This class is used to list, retrieve, create, and delete self-hosted credentials for a Deepgram project.
 */
class SelfHostedRestClient extends AbstractRestClient_1.AbstractRestClient {
    constructor() {
        super(...arguments);
        this.namespace = "selfhosted";
    }
    /**
     * Lists the self-hosted credentials for a Deepgram project.
     *
     * @param projectId - The ID of the Deepgram project.
     * @returns A promise that resolves to an object containing the list of self-hosted credentials and any error that occurred.
     * @see https://developers.deepgram.com/reference/list-credentials
     */
    listCredentials(projectId, endpoint = ":version/projects/:projectId/onprem/distribution/credentials") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId });
                const result = yield this.get(requestUrl).then((result) => result.json());
                return { result, error: null };
            }
            catch (error) {
                if ((0, errors_1.isDeepgramError)(error)) {
                    return { result: null, error };
                }
                throw error;
            }
        });
    }
    /**
     * Retrieves the self-hosted credentials for a specific Deepgram project and credentials ID.
     *
     * @param projectId - The ID of the Deepgram project.
     * @param credentialsId - The ID of the self-hosted credentials to retrieve.
     * @returns A promise that resolves to an object containing the self-hosted credentials and any error that occurred.
     * @see https://developers.deepgram.com/reference/get-credentials
     */
    getCredentials(projectId, credentialsId, endpoint = ":version/projects/:projectId/onprem/distribution/credentials/:credentialsId") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId, credentialsId });
                const result = yield this.get(requestUrl).then((result) => result.json());
                return { result, error: null };
            }
            catch (error) {
                if ((0, errors_1.isDeepgramError)(error)) {
                    return { result: null, error };
                }
                throw error;
            }
        });
    }
    /**
     * Creates self-hosted credentials for a specific Deepgram project.
     *
     * @param projectId - The ID of the Deepgram project.
     * @param options - The options for creating the self-hosted credentials.
     * @returns A promise that resolves to an object containing the created self-hosted credentials and any error that occurred.
     * @see https://developers.deepgram.com/reference/create-credentials
     */
    createCredentials(projectId, options, endpoint = ":version/projects/:projectId/onprem/distribution/credentials") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId });
                const body = JSON.stringify(options);
                const result = yield this.post(requestUrl, body).then((result) => result.json());
                return { result, error: null };
            }
            catch (error) {
                if ((0, errors_1.isDeepgramError)(error)) {
                    return { result: null, error };
                }
                throw error;
            }
        });
    }
    /**
     * Deletes self-hosted credentials for a specific Deepgram project.
     *
     * @param projectId - The ID of the Deepgram project.
     * @param credentialsId - The ID of the self-hosted credentials to delete.
     * @returns A promise that resolves to an object containing a message response and any error that occurred.
     * @see https://developers.deepgram.com/reference/delete-credentials
     */
    deleteCredentials(projectId, credentialsId, endpoint = ":version/projects/:projectId/onprem/distribution/credentials/:credentialsId") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId, credentialsId });
                const result = yield this.delete(requestUrl).then((result) => result.json());
                return { result, error: null };
            }
            catch (error) {
                if ((0, errors_1.isDeepgramError)(error)) {
                    return { result: null, error };
                }
                throw error;
            }
        });
    }
}
exports.SelfHostedRestClient = SelfHostedRestClient;
exports.OnPremClient = SelfHostedRestClient;
//# sourceMappingURL=SelfHostedRestClient.js.map