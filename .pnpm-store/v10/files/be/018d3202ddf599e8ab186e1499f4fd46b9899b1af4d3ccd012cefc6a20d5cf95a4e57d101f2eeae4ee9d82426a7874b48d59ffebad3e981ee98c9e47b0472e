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
exports.ManageClient = exports.ManageRestClient = void 0;
const errors_1 = require("../lib/errors");
const AbstractRestClient_1 = require("./AbstractRestClient");
/**
 * The `ManageRestClient` class provides a set of methods for interacting with the Deepgram Manage API. It extends the `AbstractRestClient` class and provides functionality for managing projects, keys, members, invites, usage, balances, and models.
 *
 * The class has a `namespace` property that is set to `"manage"`, which is used in the construction of the request URLs.
 *
 * The methods in this class include:
 * - `getTokenDetails`: Retrieves the details of the current authentication token.
 * - `getProjects`: Retrieves a list of all projects associated with the authenticated account.
 * - `getProject`: Retrieves the details of a specific project.
 * - `updateProject`: Updates the details of a specific project.
 * - `deleteProject`: Deletes a specific project.
 * - `getProjectKeys`: Retrieves a list of all API keys associated with a specific project.
 * - `getProjectKey`: Retrieves the details of a specific API key.
 * - `createProjectKey`: Creates a new API key for a specific project.
 * - `deleteProjectKey`: Deletes a specific API key.
 * - `getProjectMembers`: Retrieves a list of all members associated with a specific project.
 * - `removeProjectMember`: Removes a specific member from a project.
 * - `getProjectMemberScopes`: Retrieves the scopes associated with a specific project member.
 * - `updateProjectMemberScope`: Updates the scopes associated with a specific project member.
 * - `getProjectInvites`: Retrieves a list of all pending invitations for a specific project.
 * - `sendProjectInvite`: Sends a new invitation to a specific email address for a project.
 * - `deleteProjectInvite`: Deletes a specific invitation for a project.
 * - `leaveProject`: Removes the authenticated user from a specific project.
 * - `getProjectUsageRequests`: Retrieves a list of all usage requests for a specific project.
 * - `getProjectUsageRequest`: Retrieves the details of a specific usage request.
 * - `getProjectUsageSummary`: Retrieves a summary of the usage for a specific project.
 * - `getProjectUsageFields`: Retrieves a list of the available usage fields for a specific project.
 * - `getProjectBalances`: Retrieves a list of all balances associated with a specific project.
 * - `getProjectBalance`: Retrieves the details of a specific balance for a project.
 * - `getAllModels`: Retrieves all models for a project.
 * - `getModel`: Retrieves a specific model.
 */
class ManageRestClient extends AbstractRestClient_1.AbstractRestClient {
    constructor() {
        super(...arguments);
        this.namespace = "manage";
    }
    /**
     * Retrieves the details of the current authentication token.
     *
     * @returns A promise that resolves to an object containing the token details, or an error object if an error occurs.
     * @see https://developers.deepgram.com/docs/authenticating#test-request
     */
    getTokenDetails(endpoint = ":version/auth/token") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint);
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
     * Retrieves a list of all projects associated with the authenticated user.
     *
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects".
     * @returns A promise that resolves to an object containing the list of projects, or an error object if an error occurs.
     * @see https://developers.deepgram.com/reference/get-projects
     */
    getProjects(endpoint = ":version/projects") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint);
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
     * Retrieves the details of a specific project associated with the authenticated user.
     *
     * @param projectId - The ID of the project to retrieve.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId".
     * @returns A promise that resolves to an object containing the project details, or an error object if an error occurs.
     * @see https://developers.deepgram.com/reference/get-project
     */
    getProject(projectId, endpoint = ":version/projects/:projectId") {
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
     * Updates an existing project associated with the authenticated user.
     *
     * @param projectId - The ID of the project to update.
     * @param options - An object containing the updated project details.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId".
     * @returns A promise that resolves to an object containing the response message, or an error object if an error occurs.
     * @see https://developers.deepgram.com/reference/update-project
     */
    updateProject(projectId, options, endpoint = ":version/projects/:projectId") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
                const body = JSON.stringify(options);
                const result = yield this.patch(requestUrl, body).then((result) => result.json());
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
     * Deletes an existing project associated with the authenticated user.
     *
     * @param projectId - The ID of the project to delete.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId".
     * @returns A promise that resolves to an object containing the response message, or an error object if an error occurs.
     * @see https://developers.deepgram.com/reference/delete-project
     */
    deleteProject(projectId, endpoint = ":version/projects/:projectId") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId });
                yield this.delete(requestUrl);
                return { error: null };
            }
            catch (error) {
                if ((0, errors_1.isDeepgramError)(error)) {
                    return { error };
                }
                throw error;
            }
        });
    }
    /**
     * Retrieves a list of project keys associated with the specified project.
     *
     * @param projectId - The ID of the project to retrieve the keys for.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/keys".
     * @returns A promise that resolves to an object containing the list of project keys, or an error object if an error occurs.
     * @see https://developers.deepgram.com/reference/list-keys
     */
    getProjectKeys(projectId, endpoint = ":version/projects/:projectId/keys") {
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
     * Retrieves a specific project key associated with the specified project.
     *
     * @param projectId - The ID of the project to retrieve the key for.
     * @param keyId - The ID of the project key to retrieve.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/keys/:keyId".
     * @returns A promise that resolves to an object containing the project key, or an error object if an error occurs.
     * @see https://developers.deepgram.com/reference/get-key
     */
    getProjectKey(projectId, keyId, endpoint = ":version/projects/:projectId/keys/:keyId") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId, keyId });
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
     * Creates a new project key for the specified project.
     *
     * @param projectId - The ID of the project to create the key for.
     * @param options - An object containing the options for creating the project key.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/keys".
     * @returns A promise that resolves to an object containing the created project key, or an error object if an error occurs.
     * @see https://developers.deepgram.com/reference/create-key
     */
    createProjectKey(projectId, options, endpoint = ":version/projects/:projectId/keys") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
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
     * Deletes the specified project key.
     *
     * @param projectId - The ID of the project the key belongs to.
     * @param keyId - The ID of the key to delete.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/keys/:keyId".
     * @returns A promise that resolves to an object containing a null result and an error object if an error occurs.
     * @see https://developers.deepgram.com/reference/delete-key
     */
    deleteProjectKey(projectId, keyId, endpoint = ":version/projects/:projectId/keys/:keyId") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId, keyId });
                yield this.delete(requestUrl);
                return { error: null };
            }
            catch (error) {
                if ((0, errors_1.isDeepgramError)(error)) {
                    return { error };
                }
                throw error;
            }
        });
    }
    /**
     * Retrieves the members of the specified project.
     *
     * @param projectId - The ID of the project to retrieve members for.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/members".
     * @returns A promise that resolves to an object containing the project members and an error object if an error occurs.
     * @see https://developers.deepgram.com/reference/get-members
     */
    getProjectMembers(projectId, endpoint = ":version/projects/:projectId/members") {
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
     * Removes a member from the specified project.
     *
     * @param projectId - The ID of the project to remove the member from.
     * @param memberId - The ID of the member to remove.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/members/:memberId".
     * @returns A promise that resolves to an object containing a null error if the operation was successful, or an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/remove-member
     */
    removeProjectMember(projectId, memberId, endpoint = ":version/projects/:projectId/members/:memberId") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId, memberId });
                yield this.delete(requestUrl);
                return { error: null };
            }
            catch (error) {
                if ((0, errors_1.isDeepgramError)(error)) {
                    return { error };
                }
                throw error;
            }
        });
    }
    /**
     * Retrieves the scopes for the specified project member.
     *
     * @param projectId - The ID of the project to retrieve the member scopes for.
     * @param memberId - The ID of the member to retrieve the scopes for.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/members/:memberId/scopes".
     * @returns A promise that resolves to an object containing the retrieved scopes or an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/get-member-scopes
     */
    getProjectMemberScopes(projectId, memberId, endpoint = ":version/projects/:projectId/members/:memberId/scopes") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId, memberId });
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
     * Updates the scopes for the specified project member.
     *
     * @param projectId - The ID of the project to update the member scopes for.
     * @param memberId - The ID of the member to update the scopes for.
     * @param options - An object containing the new scopes to apply to the member.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/members/:memberId/scopes".
     * @returns A promise that resolves to an object containing the result of the update operation or an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/update-scope
     */
    updateProjectMemberScope(projectId, memberId, options, endpoint = ":version/projects/:projectId/members/:memberId/scopes") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId, memberId }, options);
                const body = JSON.stringify(options);
                const result = yield this.put(requestUrl, body).then((result) => result.json());
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
     * Retrieves the project invites for the specified project.
     *
     * @param projectId - The ID of the project to retrieve the invites for.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/invites".
     * @returns A promise that resolves to an object containing the result of the get operation or an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/list-invites
     */
    getProjectInvites(projectId, endpoint = ":version/projects/:projectId/invites") {
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
     * Sends a project invite to the specified email addresses.
     *
     * @param projectId - The ID of the project to send the invite for.
     * @param options - An object containing the email addresses to invite and any additional options.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/invites".
     * @returns A promise that resolves to an object containing the result of the post operation or an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/send-invites
     */
    sendProjectInvite(projectId, options, endpoint = ":version/projects/:projectId/invites") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
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
     * Deletes a project invite for the specified email address.
     *
     * @param projectId - The ID of the project to delete the invite for.
     * @param email - The email address of the invite to delete.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/invites/:email".
     * @returns A promise that resolves to an object containing a null result and an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/delete-invite
     */
    deleteProjectInvite(projectId, email, endpoint = ":version/projects/:projectId/invites/:email") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId, email });
                yield this.delete(requestUrl).then((result) => result.json());
                return { error: null };
            }
            catch (error) {
                if ((0, errors_1.isDeepgramError)(error)) {
                    return { error };
                }
                throw error;
            }
        });
    }
    /**
     * Leaves the specified project.
     *
     * @param projectId - The ID of the project to leave.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/leave".
     * @returns A promise that resolves to an object containing a null result and an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/leave-project
     */
    leaveProject(projectId, endpoint = ":version/projects/:projectId/leave") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId });
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
    /**
     * Retrieves a list of usage requests for the specified project.
     *
     * @param projectId - The ID of the project to retrieve usage requests for.
     * @param options - An object containing options to filter the usage requests, such as pagination parameters.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/requests".
     * @returns A promise that resolves to an object containing the list of usage requests and an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/get-all-requests
     */
    getProjectUsageRequests(projectId, options, endpoint = ":version/projects/:projectId/requests") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
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
     * Retrieves the details of a specific usage request for the specified project.
     *
     * @param projectId - The ID of the project to retrieve the usage request for.
     * @param requestId - The ID of the usage request to retrieve.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/requests/:requestId".
     * @returns A promise that resolves to an object containing the usage request details and an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/get-request
     */
    getProjectUsageRequest(projectId, requestId, endpoint = ":version/projects/:projectId/requests/:requestId") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId, requestId });
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
     * Retrieves the usage summary for the specified project.
     *
     * @param projectId - The ID of the project to retrieve the usage summary for.
     * @param options - An object containing optional parameters for the request, such as filters and pagination options.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/usage".
     * @returns A promise that resolves to an object containing the usage summary and an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/get-usage
     */
    getProjectUsageSummary(projectId, options, endpoint = ":version/projects/:projectId/usage") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
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
     * Retrieves the usage fields for the specified project.
     *
     * @param projectId - The ID of the project to retrieve the usage fields for.
     * @param options - An object containing optional parameters for the request, such as filters and pagination options.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/usage/fields".
     * @returns A promise that resolves to an object containing the usage fields and an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/get-fields
     */
    getProjectUsageFields(projectId, options, endpoint = ":version/projects/:projectId/usage/fields") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
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
     * Retrieves the balances for the specified project.
     *
     * @param projectId - The ID of the project to retrieve the balances for.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/balances".
     * @returns A promise that resolves to an object containing the project balances and an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/get-all-balances
     */
    getProjectBalances(projectId, endpoint = ":version/projects/:projectId/balances") {
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
     * Retrieves the balance for the specified project and balance ID.
     *
     * @param projectId - The ID of the project to retrieve the balance for.
     * @param balanceId - The ID of the balance to retrieve.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/projects/:projectId/balances/:balanceId".
     * @returns A promise that resolves to an object containing the project balance and an error object if an error occurred.
     * @see https://developers.deepgram.com/reference/get-balance
     */
    getProjectBalance(projectId, balanceId, endpoint = ":version/projects/:projectId/balances/:balanceId") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId, balanceId });
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
     * Retrieves all models for a given project.
     *
     * @param projectId - The ID of the project.
     * @param endpoint - (optional) The endpoint URL for retrieving models. Defaults to ":version/projects/:projectId/models".
     * @returns A promise that resolves to a DeepgramResponse containing the GetModelsResponse.
     * @example
     * ```typescript
     * import { createClient } from "@deepgram/sdk";
     *
     * const deepgram = createClient(DEEPGRAM_API_KEY);
     * const { result: models, error } = deepgram.manage.getAllModels("projectId");
     *
     * if (error) {
     *   console.error(error);
     * } else {
     *   console.log(models);
     * }
     * ```
     */
    getAllModels(projectId, options = {}, endpoint = ":version/projects/:projectId/models") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId }, options);
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
     * Retrieves a model from the specified project.
     *
     * @param projectId - The ID of the project.
     * @param modelId - The ID of the model.
     * @param endpoint - (optional) The endpoint URL for the request. Default value is ":version/projects/:projectId/models/:modelId".
     * @returns A promise that resolves to a DeepgramResponse containing the GetModelResponse.
     * @example
     * ```typescript
     * import { createClient } from "@deepgram/sdk";
     *
     * const deepgram = createClient(DEEPGRAM_API_KEY);
     * const { result: model, error } = deepgram.models.getModel("projectId", "modelId");
     *
     * if (error) {
     *   console.error(error);
     * } else {
     *   console.log(model);
     * }
     * ```
     */
    getModel(projectId, modelId, endpoint = ":version/projects/:projectId/models/:modelId") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestUrl = this.getRequestUrl(endpoint, { projectId, modelId });
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
}
exports.ManageRestClient = ManageRestClient;
exports.ManageClient = ManageRestClient;
//# sourceMappingURL=ManageRestClient.js.map