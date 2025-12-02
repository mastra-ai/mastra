import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as ProfilesCustomAPI from "../profiles/custom.js";
export declare class Custom extends APIResource {
    /**
     * Creates a DLP custom entry.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.zeroTrust.dlp.entries.custom.create({
     *     account_id: 'account_id',
     *     enabled: true,
     *     name: 'name',
     *     pattern: { regex: 'regex' },
     *     profile_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   });
     * ```
     */
    create(params: CustomCreateParams, options?: Core.RequestOptions): Core.APIPromise<CustomCreateResponse>;
    /**
     * Updates a DLP entry.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.zeroTrust.dlp.entries.custom.update(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     {
     *       account_id: 'account_id',
     *       name: 'name',
     *       pattern: { regex: 'regex' },
     *       type: 'custom',
     *     },
     *   );
     * ```
     */
    update(entryId: string, params: CustomUpdateParams, options?: Core.RequestOptions): Core.APIPromise<CustomUpdateResponse>;
    /**
     * Deletes a DLP custom entry.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.zeroTrust.dlp.entries.custom.delete(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(entryId: string, params: CustomDeleteParams, options?: Core.RequestOptions): Core.APIPromise<CustomDeleteResponse | null>;
}
export interface CustomCreateResponse {
    id: string;
    created_at: string;
    enabled: boolean;
    name: string;
    pattern: ProfilesCustomAPI.Pattern;
    updated_at: string;
    profile_id?: string | null;
}
export type CustomUpdateResponse = CustomUpdateResponse.CustomEntry | CustomUpdateResponse.PredefinedEntry | CustomUpdateResponse.IntegrationEntry | CustomUpdateResponse.ExactDataEntry | CustomUpdateResponse.DocumentFingerprintEntry | CustomUpdateResponse.WordListEntry;
export declare namespace CustomUpdateResponse {
    interface CustomEntry {
        id: string;
        created_at: string;
        enabled: boolean;
        name: string;
        pattern: ProfilesCustomAPI.Pattern;
        type: 'custom';
        updated_at: string;
        profile_id?: string | null;
    }
    interface PredefinedEntry {
        id: string;
        confidence: PredefinedEntry.Confidence;
        enabled: boolean;
        name: string;
        type: 'predefined';
        profile_id?: string | null;
    }
    namespace PredefinedEntry {
        interface Confidence {
            /**
             * Indicates whether this entry has AI remote service validation.
             */
            ai_context_available: boolean;
            /**
             * Indicates whether this entry has any form of validation that is not an AI remote
             * service.
             */
            available: boolean;
        }
    }
    interface IntegrationEntry {
        id: string;
        created_at: string;
        enabled: boolean;
        name: string;
        type: 'integration';
        updated_at: string;
        profile_id?: string | null;
    }
    interface ExactDataEntry {
        id: string;
        /**
         * Only applies to custom word lists. Determines if the words should be matched in
         * a case-sensitive manner Cannot be set to false if secret is true
         */
        case_sensitive: boolean;
        created_at: string;
        enabled: boolean;
        name: string;
        secret: boolean;
        type: 'exact_data';
        updated_at: string;
    }
    interface DocumentFingerprintEntry {
        id: string;
        created_at: string;
        enabled: boolean;
        name: string;
        type: 'document_fingerprint';
        updated_at: string;
    }
    interface WordListEntry {
        id: string;
        created_at: string;
        enabled: boolean;
        name: string;
        type: 'word_list';
        updated_at: string;
        word_list: unknown;
        profile_id?: string | null;
    }
}
export type CustomDeleteResponse = unknown;
export interface CustomCreateParams {
    /**
     * Path param:
     */
    account_id: string;
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
    pattern: ProfilesCustomAPI.PatternParam;
    /**
     * Body param:
     */
    profile_id: string;
}
export type CustomUpdateParams = CustomUpdateParams.Variant0 | CustomUpdateParams.Variant1 | CustomUpdateParams.Variant2;
export declare namespace CustomUpdateParams {
    interface Variant0 {
        /**
         * Path param:
         */
        account_id: string;
        /**
         * Body param:
         */
        name: string;
        /**
         * Body param:
         */
        pattern: ProfilesCustomAPI.PatternParam;
        /**
         * Body param:
         */
        type: 'custom';
        /**
         * Body param:
         */
        enabled?: boolean;
    }
    interface Variant1 {
        /**
         * Path param:
         */
        account_id: string;
        /**
         * Body param:
         */
        type: 'predefined';
        /**
         * Body param:
         */
        enabled?: boolean;
    }
    interface Variant2 {
        /**
         * Path param:
         */
        account_id: string;
        /**
         * Body param:
         */
        type: 'integration';
        /**
         * Body param:
         */
        enabled?: boolean;
    }
}
export interface CustomDeleteParams {
    account_id: string;
}
export declare namespace Custom {
    export { type CustomCreateResponse as CustomCreateResponse, type CustomUpdateResponse as CustomUpdateResponse, type CustomDeleteResponse as CustomDeleteResponse, type CustomCreateParams as CustomCreateParams, type CustomUpdateParams as CustomUpdateParams, type CustomDeleteParams as CustomDeleteParams, };
}
//# sourceMappingURL=custom.d.ts.map