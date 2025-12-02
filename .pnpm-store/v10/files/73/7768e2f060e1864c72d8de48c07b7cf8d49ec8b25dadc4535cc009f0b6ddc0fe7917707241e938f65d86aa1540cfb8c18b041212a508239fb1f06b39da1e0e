import type { CreateOnPremCredentialsSchema, DeepgramResponse, ListOnPremCredentialsResponse, MessageResponse, OnPremCredentialResponse } from "../lib/types";
import { AbstractRestClient } from "./AbstractRestClient";
/**
 * The `SelfHostedRestClient` class extends the `AbstractRestClient` class and provides methods for interacting with the Deepgram self-hosted API.
 *
 * This class is used to list, retrieve, create, and delete self-hosted credentials for a Deepgram project.
 */
export declare class SelfHostedRestClient extends AbstractRestClient {
    namespace: string;
    /**
     * Lists the self-hosted credentials for a Deepgram project.
     *
     * @param projectId - The ID of the Deepgram project.
     * @returns A promise that resolves to an object containing the list of self-hosted credentials and any error that occurred.
     * @see https://developers.deepgram.com/reference/list-credentials
     */
    listCredentials(projectId: string, endpoint?: string): Promise<DeepgramResponse<ListOnPremCredentialsResponse>>;
    /**
     * Retrieves the self-hosted credentials for a specific Deepgram project and credentials ID.
     *
     * @param projectId - The ID of the Deepgram project.
     * @param credentialsId - The ID of the self-hosted credentials to retrieve.
     * @returns A promise that resolves to an object containing the self-hosted credentials and any error that occurred.
     * @see https://developers.deepgram.com/reference/get-credentials
     */
    getCredentials(projectId: string, credentialsId: string, endpoint?: string): Promise<DeepgramResponse<OnPremCredentialResponse>>;
    /**
     * Creates self-hosted credentials for a specific Deepgram project.
     *
     * @param projectId - The ID of the Deepgram project.
     * @param options - The options for creating the self-hosted credentials.
     * @returns A promise that resolves to an object containing the created self-hosted credentials and any error that occurred.
     * @see https://developers.deepgram.com/reference/create-credentials
     */
    createCredentials(projectId: string, options: CreateOnPremCredentialsSchema, endpoint?: string): Promise<DeepgramResponse<OnPremCredentialResponse>>;
    /**
     * Deletes self-hosted credentials for a specific Deepgram project.
     *
     * @param projectId - The ID of the Deepgram project.
     * @param credentialsId - The ID of the self-hosted credentials to delete.
     * @returns A promise that resolves to an object containing a message response and any error that occurred.
     * @see https://developers.deepgram.com/reference/delete-credentials
     */
    deleteCredentials(projectId: string, credentialsId: string, endpoint?: string): Promise<DeepgramResponse<MessageResponse>>;
}
export { SelfHostedRestClient as OnPremClient };
//# sourceMappingURL=SelfHostedRestClient.d.ts.map