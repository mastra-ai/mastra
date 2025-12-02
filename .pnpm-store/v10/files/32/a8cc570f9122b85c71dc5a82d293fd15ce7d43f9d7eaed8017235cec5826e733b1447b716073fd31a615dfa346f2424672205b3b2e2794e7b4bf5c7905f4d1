import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { SinglePage } from "../../../../pagination.js";
export declare class Rules extends APIResource {
    /**
     * Create email scanner rule
     *
     * @example
     * ```ts
     * const rule = await client.zeroTrust.dlp.email.rules.create({
     *   account_id: 'account_id',
     *   action: { action: 'Block' },
     *   conditions: [
     *     {
     *       operator: 'InList',
     *       selector: 'Recipients',
     *       value: ['string'],
     *     },
     *   ],
     *   enabled: true,
     *   name: 'name',
     * });
     * ```
     */
    create(params: RuleCreateParams, options?: Core.RequestOptions): Core.APIPromise<RuleCreateResponse>;
    /**
     * Update email scanner rule
     *
     * @example
     * ```ts
     * const rule = await client.zeroTrust.dlp.email.rules.update(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   {
     *     account_id: 'account_id',
     *     action: { action: 'Block' },
     *     conditions: [
     *       {
     *         operator: 'InList',
     *         selector: 'Recipients',
     *         value: ['string'],
     *       },
     *     ],
     *     enabled: true,
     *     name: 'name',
     *   },
     * );
     * ```
     */
    update(ruleId: string, params: RuleUpdateParams, options?: Core.RequestOptions): Core.APIPromise<RuleUpdateResponse>;
    /**
     * Lists all email scanner rules for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ruleListResponse of client.zeroTrust.dlp.email.rules.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: RuleListParams, options?: Core.RequestOptions): Core.PagePromise<RuleListResponsesSinglePage, RuleListResponse>;
    /**
     * Delete email scanner rule
     *
     * @example
     * ```ts
     * const rule = await client.zeroTrust.dlp.email.rules.delete(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    delete(ruleId: string, params: RuleDeleteParams, options?: Core.RequestOptions): Core.APIPromise<RuleDeleteResponse>;
    /**
     * Update email scanner rule priorities
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.dlp.email.rules.bulkEdit({
     *     account_id: 'account_id',
     *     new_priorities: { foo: 0 },
     *   });
     * ```
     */
    bulkEdit(params: RuleBulkEditParams, options?: Core.RequestOptions): Core.APIPromise<RuleBulkEditResponse>;
    /**
     * Get an email scanner rule
     *
     * @example
     * ```ts
     * const rule = await client.zeroTrust.dlp.email.rules.get(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(ruleId: string, params: RuleGetParams, options?: Core.RequestOptions): Core.APIPromise<RuleGetResponse>;
}
export declare class RuleListResponsesSinglePage extends SinglePage<RuleListResponse> {
}
export interface RuleCreateResponse {
    action: RuleCreateResponse.Action;
    /**
     * Rule is triggered if all conditions match.
     */
    conditions: Array<RuleCreateResponse.Condition>;
    created_at: string;
    enabled: boolean;
    name: string;
    priority: number;
    rule_id: string;
    updated_at: string;
    description?: string | null;
}
export declare namespace RuleCreateResponse {
    interface Action {
        action: 'Block';
        message?: string | null;
    }
    interface Condition {
        operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';
        selector: 'Recipients' | 'Sender' | 'DLPProfiles';
        value: Array<string> | string;
    }
}
export interface RuleUpdateResponse {
    action: RuleUpdateResponse.Action;
    /**
     * Rule is triggered if all conditions match.
     */
    conditions: Array<RuleUpdateResponse.Condition>;
    created_at: string;
    enabled: boolean;
    name: string;
    priority: number;
    rule_id: string;
    updated_at: string;
    description?: string | null;
}
export declare namespace RuleUpdateResponse {
    interface Action {
        action: 'Block';
        message?: string | null;
    }
    interface Condition {
        operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';
        selector: 'Recipients' | 'Sender' | 'DLPProfiles';
        value: Array<string> | string;
    }
}
export interface RuleListResponse {
    action: RuleListResponse.Action;
    /**
     * Rule is triggered if all conditions match.
     */
    conditions: Array<RuleListResponse.Condition>;
    created_at: string;
    enabled: boolean;
    name: string;
    priority: number;
    rule_id: string;
    updated_at: string;
    description?: string | null;
}
export declare namespace RuleListResponse {
    interface Action {
        action: 'Block';
        message?: string | null;
    }
    interface Condition {
        operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';
        selector: 'Recipients' | 'Sender' | 'DLPProfiles';
        value: Array<string> | string;
    }
}
export interface RuleDeleteResponse {
    action: RuleDeleteResponse.Action;
    /**
     * Rule is triggered if all conditions match.
     */
    conditions: Array<RuleDeleteResponse.Condition>;
    created_at: string;
    enabled: boolean;
    name: string;
    priority: number;
    rule_id: string;
    updated_at: string;
    description?: string | null;
}
export declare namespace RuleDeleteResponse {
    interface Action {
        action: 'Block';
        message?: string | null;
    }
    interface Condition {
        operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';
        selector: 'Recipients' | 'Sender' | 'DLPProfiles';
        value: Array<string> | string;
    }
}
export interface RuleBulkEditResponse {
    action: RuleBulkEditResponse.Action;
    /**
     * Rule is triggered if all conditions match.
     */
    conditions: Array<RuleBulkEditResponse.Condition>;
    created_at: string;
    enabled: boolean;
    name: string;
    priority: number;
    rule_id: string;
    updated_at: string;
    description?: string | null;
}
export declare namespace RuleBulkEditResponse {
    interface Action {
        action: 'Block';
        message?: string | null;
    }
    interface Condition {
        operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';
        selector: 'Recipients' | 'Sender' | 'DLPProfiles';
        value: Array<string> | string;
    }
}
export interface RuleGetResponse {
    action: RuleGetResponse.Action;
    /**
     * Rule is triggered if all conditions match.
     */
    conditions: Array<RuleGetResponse.Condition>;
    created_at: string;
    enabled: boolean;
    name: string;
    priority: number;
    rule_id: string;
    updated_at: string;
    description?: string | null;
}
export declare namespace RuleGetResponse {
    interface Action {
        action: 'Block';
        message?: string | null;
    }
    interface Condition {
        operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';
        selector: 'Recipients' | 'Sender' | 'DLPProfiles';
        value: Array<string> | string;
    }
}
export interface RuleCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    action: RuleCreateParams.Action;
    /**
     * Body param: Rule is triggered if all conditions match.
     */
    conditions: Array<RuleCreateParams.Condition>;
    /**
     * Body param:
     */
    enabled: boolean;
    /**
     * Body param:
     */
    name: string;
    /**
     * Body param:
     */
    description?: string | null;
}
export declare namespace RuleCreateParams {
    interface Action {
        action: 'Block';
        message?: string | null;
    }
    interface Condition {
        operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';
        selector: 'Recipients' | 'Sender' | 'DLPProfiles';
        value: Array<string> | string;
    }
}
export interface RuleUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    action: RuleUpdateParams.Action;
    /**
     * Body param: Rule is triggered if all conditions match.
     */
    conditions: Array<RuleUpdateParams.Condition>;
    /**
     * Body param:
     */
    enabled: boolean;
    /**
     * Body param:
     */
    name: string;
    /**
     * Body param:
     */
    description?: string | null;
}
export declare namespace RuleUpdateParams {
    interface Action {
        action: 'Block';
        message?: string | null;
    }
    interface Condition {
        operator: 'InList' | 'NotInList' | 'MatchRegex' | 'NotMatchRegex';
        selector: 'Recipients' | 'Sender' | 'DLPProfiles';
        value: Array<string> | string;
    }
}
export interface RuleListParams {
    account_id: string;
}
export interface RuleDeleteParams {
    account_id: string;
}
export interface RuleBulkEditParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    new_priorities: {
        [key: string]: number;
    };
}
export interface RuleGetParams {
    account_id: string;
}
export declare namespace Rules {
    export { type RuleCreateResponse as RuleCreateResponse, type RuleUpdateResponse as RuleUpdateResponse, type RuleListResponse as RuleListResponse, type RuleDeleteResponse as RuleDeleteResponse, type RuleBulkEditResponse as RuleBulkEditResponse, type RuleGetResponse as RuleGetResponse, RuleListResponsesSinglePage as RuleListResponsesSinglePage, type RuleCreateParams as RuleCreateParams, type RuleUpdateParams as RuleUpdateParams, type RuleListParams as RuleListParams, type RuleDeleteParams as RuleDeleteParams, type RuleBulkEditParams as RuleBulkEditParams, type RuleGetParams as RuleGetParams, };
}
//# sourceMappingURL=rules.d.ts.map