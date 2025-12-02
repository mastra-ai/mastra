import type { ClerkPaginationRequest } from '@clerk/types';
import type { DeletedObject } from '../resources';
import type { PaginatedResourceResponse } from '../resources/Deserializer';
import type { OAuthApplication } from '../resources/OAuthApplication';
import { AbstractAPI } from './AbstractApi';
type CreateOAuthApplicationParams = {
    /**
     * The name of the new OAuth application.
     *
     * @remarks Max length: 256
     */
    name: string;
    /**
     * An array of redirect URIs of the new OAuth application
     */
    redirectUris?: Array<string> | null | undefined;
    /**
     * Define the allowed scopes for the new OAuth applications that dictate the user payload of the OAuth user info endpoint. Available scopes are `profile`, `email`, `public_metadata`, `private_metadata`. Provide the requested scopes as a string, separated by spaces.
     */
    scopes?: string | null | undefined;
    /**
     * If true, this client is public and you can use the Proof Key of Code Exchange (PKCE) flow.
     */
    public?: boolean | null | undefined;
};
type UpdateOAuthApplicationParams = CreateOAuthApplicationParams & {
    /**
     * The ID of the OAuth application to update
     */
    oauthApplicationId: string;
};
export declare class OAuthApplicationsApi extends AbstractAPI {
    list(params?: ClerkPaginationRequest): Promise<PaginatedResourceResponse<OAuthApplication[]>>;
    get(oauthApplicationId: string): Promise<OAuthApplication>;
    create(params: CreateOAuthApplicationParams): Promise<OAuthApplication>;
    update(params: UpdateOAuthApplicationParams): Promise<OAuthApplication>;
    delete(oauthApplicationId: string): Promise<DeletedObject>;
    rotateSecret(oauthApplicationId: string): Promise<OAuthApplication>;
}
export {};
//# sourceMappingURL=OAuthApplicationsApi.d.ts.map