import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class Domains extends APIResource {
    /**
     * Add a new domain for the Pages project.
     *
     * @example
     * ```ts
     * const domain = await client.pages.projects.domains.create(
     *   'this-is-my-project-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    create(projectName: string, params: DomainCreateParams, options?: Core.RequestOptions): Core.APIPromise<DomainCreateResponse | null>;
    /**
     * Fetch a list of all domains associated with a Pages project.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const domainListResponse of client.pages.projects.domains.list(
     *   'this-is-my-project-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(projectName: string, params: DomainListParams, options?: Core.RequestOptions): Core.PagePromise<DomainListResponsesSinglePage, DomainListResponse>;
    /**
     * Delete a Pages project's domain.
     *
     * @example
     * ```ts
     * const domain = await client.pages.projects.domains.delete(
     *   'this-is-my-project-01',
     *   'this-is-my-domain-01.com',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(projectName: string, domainName: string, params: DomainDeleteParams, options?: Core.RequestOptions): Core.APIPromise<DomainDeleteResponse | null>;
    /**
     * Retry the validation status of a single domain.
     *
     * @example
     * ```ts
     * const response = await client.pages.projects.domains.edit(
     *   'this-is-my-project-01',
     *   'this-is-my-domain-01.com',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {},
     *   },
     * );
     * ```
     */
    edit(projectName: string, domainName: string, params: DomainEditParams, options?: Core.RequestOptions): Core.APIPromise<DomainEditResponse | null>;
    /**
     * Fetch a single domain.
     *
     * @example
     * ```ts
     * const domain = await client.pages.projects.domains.get(
     *   'this-is-my-project-01',
     *   'this-is-my-domain-01.com',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(projectName: string, domainName: string, params: DomainGetParams, options?: Core.RequestOptions): Core.APIPromise<DomainGetResponse | null>;
}
export declare class DomainListResponsesSinglePage extends SinglePage<DomainListResponse> {
}
export interface DomainCreateResponse {
    id?: string;
    certificate_authority?: 'google' | 'lets_encrypt';
    created_on?: string;
    domain_id?: string;
    name?: string;
    status?: 'initializing' | 'pending' | 'active' | 'deactivated' | 'blocked' | 'error';
    validation_data?: DomainCreateResponse.ValidationData;
    verification_data?: DomainCreateResponse.VerificationData;
    zone_tag?: string;
}
export declare namespace DomainCreateResponse {
    interface ValidationData {
        error_message?: string;
        method?: 'http' | 'txt';
        status?: 'initializing' | 'pending' | 'active' | 'deactivated' | 'error';
        txt_name?: string;
        txt_value?: string;
    }
    interface VerificationData {
        error_message?: string;
        status?: 'pending' | 'active' | 'deactivated' | 'blocked' | 'error';
    }
}
export interface DomainListResponse {
    id?: string;
    certificate_authority?: 'google' | 'lets_encrypt';
    created_on?: string;
    domain_id?: string;
    name?: string;
    status?: 'initializing' | 'pending' | 'active' | 'deactivated' | 'blocked' | 'error';
    validation_data?: DomainListResponse.ValidationData;
    verification_data?: DomainListResponse.VerificationData;
    zone_tag?: string;
}
export declare namespace DomainListResponse {
    interface ValidationData {
        error_message?: string;
        method?: 'http' | 'txt';
        status?: 'initializing' | 'pending' | 'active' | 'deactivated' | 'error';
        txt_name?: string;
        txt_value?: string;
    }
    interface VerificationData {
        error_message?: string;
        status?: 'pending' | 'active' | 'deactivated' | 'blocked' | 'error';
    }
}
export type DomainDeleteResponse = unknown;
export interface DomainEditResponse {
    id?: string;
    certificate_authority?: 'google' | 'lets_encrypt';
    created_on?: string;
    domain_id?: string;
    name?: string;
    status?: 'initializing' | 'pending' | 'active' | 'deactivated' | 'blocked' | 'error';
    validation_data?: DomainEditResponse.ValidationData;
    verification_data?: DomainEditResponse.VerificationData;
    zone_tag?: string;
}
export declare namespace DomainEditResponse {
    interface ValidationData {
        error_message?: string;
        method?: 'http' | 'txt';
        status?: 'initializing' | 'pending' | 'active' | 'deactivated' | 'error';
        txt_name?: string;
        txt_value?: string;
    }
    interface VerificationData {
        error_message?: string;
        status?: 'pending' | 'active' | 'deactivated' | 'blocked' | 'error';
    }
}
export interface DomainGetResponse {
    id?: string;
    certificate_authority?: 'google' | 'lets_encrypt';
    created_on?: string;
    domain_id?: string;
    name?: string;
    status?: 'initializing' | 'pending' | 'active' | 'deactivated' | 'blocked' | 'error';
    validation_data?: DomainGetResponse.ValidationData;
    verification_data?: DomainGetResponse.VerificationData;
    zone_tag?: string;
}
export declare namespace DomainGetResponse {
    interface ValidationData {
        error_message?: string;
        method?: 'http' | 'txt';
        status?: 'initializing' | 'pending' | 'active' | 'deactivated' | 'error';
        txt_name?: string;
        txt_value?: string;
    }
    interface VerificationData {
        error_message?: string;
        status?: 'pending' | 'active' | 'deactivated' | 'blocked' | 'error';
    }
}
export interface DomainCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    name?: string;
}
export interface DomainListParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface DomainDeleteParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface DomainEditParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export interface DomainGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace Domains {
    export { type DomainCreateResponse as DomainCreateResponse, type DomainListResponse as DomainListResponse, type DomainDeleteResponse as DomainDeleteResponse, type DomainEditResponse as DomainEditResponse, type DomainGetResponse as DomainGetResponse, DomainListResponsesSinglePage as DomainListResponsesSinglePage, type DomainCreateParams as DomainCreateParams, type DomainListParams as DomainListParams, type DomainDeleteParams as DomainDeleteParams, type DomainEditParams as DomainEditParams, type DomainGetParams as DomainGetParams, };
}
//# sourceMappingURL=domains.d.ts.map