import { isDeepgramError } from "../lib/errors";
import type {
  CreateOnPremCredentialsSchema,
  DeepgramResponse,
  ListOnPremCredentialsResponse,
  MessageResponse,
  OnPremCredentialResponse,
} from "../lib/types";
import { AbstractRestClient } from "./AbstractRestClient";

/**
 * The `SelfHostedRestClient` class extends the `AbstractRestClient` class and provides methods for interacting with the Deepgram self-hosted API.
 *
 * This class is used to list, retrieve, create, and delete self-hosted credentials for a Deepgram project.
 */
export class SelfHostedRestClient extends AbstractRestClient {
  public namespace: string = "selfhosted";

  /**
   * Lists the self-hosted credentials for a Deepgram project.
   *
   * @param projectId - The ID of the Deepgram project.
   * @returns A promise that resolves to an object containing the list of self-hosted credentials and any error that occurred.
   * @see https://developers.deepgram.com/reference/list-credentials
   */
  async listCredentials(
    projectId: string,
    endpoint = ":version/projects/:projectId/onprem/distribution/credentials"
  ): Promise<DeepgramResponse<ListOnPremCredentialsResponse>> {
    try {
      const requestUrl = this.getRequestUrl(endpoint, { projectId });
      const result: ListOnPremCredentialsResponse = await this.get(requestUrl).then((result) =>
        result.json()
      );

      return { result, error: null };
    } catch (error) {
      if (isDeepgramError(error)) {
        return { result: null, error };
      }

      throw error;
    }
  }

  /**
   * Retrieves the self-hosted credentials for a specific Deepgram project and credentials ID.
   *
   * @param projectId - The ID of the Deepgram project.
   * @param credentialsId - The ID of the self-hosted credentials to retrieve.
   * @returns A promise that resolves to an object containing the self-hosted credentials and any error that occurred.
   * @see https://developers.deepgram.com/reference/get-credentials
   */
  async getCredentials(
    projectId: string,
    credentialsId: string,
    endpoint = ":version/projects/:projectId/onprem/distribution/credentials/:credentialsId"
  ): Promise<DeepgramResponse<OnPremCredentialResponse>> {
    try {
      const requestUrl = this.getRequestUrl(endpoint, { projectId, credentialsId });
      const result: OnPremCredentialResponse = await this.get(requestUrl).then((result) =>
        result.json()
      );

      return { result, error: null };
    } catch (error) {
      if (isDeepgramError(error)) {
        return { result: null, error };
      }

      throw error;
    }
  }

  /**
   * Creates self-hosted credentials for a specific Deepgram project.
   *
   * @param projectId - The ID of the Deepgram project.
   * @param options - The options for creating the self-hosted credentials.
   * @returns A promise that resolves to an object containing the created self-hosted credentials and any error that occurred.
   * @see https://developers.deepgram.com/reference/create-credentials
   */
  async createCredentials(
    projectId: string,
    options: CreateOnPremCredentialsSchema,
    endpoint = ":version/projects/:projectId/onprem/distribution/credentials"
  ): Promise<DeepgramResponse<OnPremCredentialResponse>> {
    try {
      const requestUrl = this.getRequestUrl(endpoint, { projectId });
      const body = JSON.stringify(options);

      const result: OnPremCredentialResponse = await this.post(requestUrl, body).then((result) =>
        result.json()
      );

      return { result, error: null };
    } catch (error) {
      if (isDeepgramError(error)) {
        return { result: null, error };
      }

      throw error;
    }
  }

  /**
   * Deletes self-hosted credentials for a specific Deepgram project.
   *
   * @param projectId - The ID of the Deepgram project.
   * @param credentialsId - The ID of the self-hosted credentials to delete.
   * @returns A promise that resolves to an object containing a message response and any error that occurred.
   * @see https://developers.deepgram.com/reference/delete-credentials
   */
  async deleteCredentials(
    projectId: string,
    credentialsId: string,
    endpoint = ":version/projects/:projectId/onprem/distribution/credentials/:credentialsId"
  ): Promise<DeepgramResponse<MessageResponse>> {
    try {
      const requestUrl = this.getRequestUrl(endpoint, { projectId, credentialsId });
      const result: MessageResponse = await this.delete(requestUrl).then((result) => result.json());

      return { result, error: null };
    } catch (error) {
      if (isDeepgramError(error)) {
        return { result: null, error };
      }

      throw error;
    }
  }
}

export { SelfHostedRestClient as OnPremClient };
