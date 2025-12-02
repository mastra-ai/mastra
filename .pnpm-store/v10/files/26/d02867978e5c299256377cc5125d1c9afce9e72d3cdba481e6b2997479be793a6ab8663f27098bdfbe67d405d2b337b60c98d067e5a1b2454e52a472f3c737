import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as RequestsAPI from "./requests.js";
export declare class PriorityResource extends APIResource {
    /**
     * Create a New Priority Intelligence Requirement
     *
     * @example
     * ```ts
     * const priority =
     *   await client.cloudforceOne.requests.priority.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     labels: ['DoS', 'CVE'],
     *     priority: 1,
     *     requirement: 'DoS attacks carried out by CVEs',
     *     tlp: 'clear',
     *   });
     * ```
     */
    create(params: PriorityCreateParams, options?: Core.RequestOptions): Core.APIPromise<Priority>;
    /**
     * Update a Priority Intelligence Requirement
     *
     * @example
     * ```ts
     * const item =
     *   await client.cloudforceOne.requests.priority.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       labels: ['DoS', 'CVE'],
     *       priority: 1,
     *       requirement: 'DoS attacks carried out by CVEs',
     *       tlp: 'clear',
     *     },
     *   );
     * ```
     */
    update(priorityId: string, params: PriorityUpdateParams, options?: Core.RequestOptions): Core.APIPromise<RequestsAPI.Item>;
    /**
     * Delete a Priority Intelligence Requirement
     *
     * @example
     * ```ts
     * const priority =
     *   await client.cloudforceOne.requests.priority.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(priorityId: string, params: PriorityDeleteParams, options?: Core.RequestOptions): Core.APIPromise<PriorityDeleteResponse>;
    /**
     * Get a Priority Intelligence Requirement
     *
     * @example
     * ```ts
     * const item =
     *   await client.cloudforceOne.requests.priority.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(priorityId: string, params: PriorityGetParams, options?: Core.RequestOptions): Core.APIPromise<RequestsAPI.Item>;
    /**
     * Get Priority Intelligence Requirement Quota
     *
     * @example
     * ```ts
     * const quota =
     *   await client.cloudforceOne.requests.priority.quota({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    quota(params: PriorityQuotaParams, options?: Core.RequestOptions): Core.APIPromise<RequestsAPI.Quota>;
}
export type Label = string;
export type LabelParam = string;
export interface Priority {
    /**
     * UUID.
     */
    id: string;
    /**
     * Priority creation time.
     */
    created: string;
    /**
     * List of labels.
     */
    labels: Array<Label>;
    /**
     * Priority.
     */
    priority: number;
    /**
     * Requirement.
     */
    requirement: string;
    /**
     * The CISA defined Traffic Light Protocol (TLP).
     */
    tlp: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';
    /**
     * Priority last updated time.
     */
    updated: string;
}
export interface PriorityEdit {
    /**
     * List of labels.
     */
    labels: Array<Label>;
    /**
     * Priority.
     */
    priority: number;
    /**
     * Requirement.
     */
    requirement: string;
    /**
     * The CISA defined Traffic Light Protocol (TLP).
     */
    tlp: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';
}
export interface PriorityDeleteResponse {
    errors: Array<PriorityDeleteResponse.Error>;
    messages: Array<PriorityDeleteResponse.Message>;
    /**
     * Whether the API call was successful.
     */
    success: true;
}
export declare namespace PriorityDeleteResponse {
    interface Error {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Error.Source;
    }
    namespace Error {
        interface Source {
            pointer?: string;
        }
    }
    interface Message {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Message.Source;
    }
    namespace Message {
        interface Source {
            pointer?: string;
        }
    }
}
export interface PriorityCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: List of labels.
     */
    labels: Array<LabelParam>;
    /**
     * Body param: Priority.
     */
    priority: number;
    /**
     * Body param: Requirement.
     */
    requirement: string;
    /**
     * Body param: The CISA defined Traffic Light Protocol (TLP).
     */
    tlp: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';
}
export interface PriorityUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: List of labels.
     */
    labels: Array<LabelParam>;
    /**
     * Body param: Priority.
     */
    priority: number;
    /**
     * Body param: Requirement.
     */
    requirement: string;
    /**
     * Body param: The CISA defined Traffic Light Protocol (TLP).
     */
    tlp: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';
}
export interface PriorityDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface PriorityGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface PriorityQuotaParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace PriorityResource {
    export { type Label as Label, type Priority as Priority, type PriorityEdit as PriorityEdit, type PriorityDeleteResponse as PriorityDeleteResponse, type PriorityCreateParams as PriorityCreateParams, type PriorityUpdateParams as PriorityUpdateParams, type PriorityDeleteParams as PriorityDeleteParams, type PriorityGetParams as PriorityGetParams, type PriorityQuotaParams as PriorityQuotaParams, };
}
//# sourceMappingURL=priority.d.ts.map