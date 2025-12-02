import type { ClerkPaginationRequest } from '@clerk/types';
import type { DeletedObject, JwtTemplate } from '../resources';
import { AbstractAPI } from './AbstractApi';
type Claims = object;
type CreateJWTTemplateParams = {
    /**
     * JWT template name
     */
    name: string;
    /**
     * JWT template claims in JSON format
     */
    claims: Claims;
    /**
     * JWT token lifetime
     */
    lifetime?: number | null | undefined;
    /**
     * JWT token allowed clock skew
     */
    allowedClockSkew?: number | null | undefined;
    /**
     * Whether a custom signing key/algorithm is also provided for this template
     */
    customSigningKey?: boolean | undefined;
    /**
     * The custom signing algorithm to use when minting JWTs. Required if `custom_signing_key` is `true`.
     */
    signingAlgorithm?: string | null | undefined;
    /**
     * The custom signing private key to use when minting JWTs. Required if `custom_signing_key` is `true`.
     */
    signingKey?: string | null | undefined;
};
type UpdateJWTTemplateParams = CreateJWTTemplateParams & {
    /**
     * JWT template ID
     */
    templateId: string;
};
export declare class JwtTemplatesApi extends AbstractAPI {
    list(params?: ClerkPaginationRequest): Promise<JwtTemplate[]>;
    get(templateId: string): Promise<JwtTemplate>;
    create(params: CreateJWTTemplateParams): Promise<JwtTemplate>;
    update(params: UpdateJWTTemplateParams): Promise<JwtTemplate>;
    delete(templateId: string): Promise<DeletedObject>;
}
export {};
//# sourceMappingURL=JwtTemplatesApi.d.ts.map