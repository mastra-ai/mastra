import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as CustomAPI from "./custom.js";
import * as ProfilesAPI from "./profiles.js";
export declare class Custom extends APIResource {
    /**
     * Creates a DLP custom profile.
     *
     * @example
     * ```ts
     * const profile =
     *   await client.zeroTrust.dlp.profiles.custom.create({
     *     account_id: 'account_id',
     *     entries: [
     *       {
     *         enabled: true,
     *         name: 'name',
     *         pattern: { regex: 'regex' },
     *       },
     *     ],
     *     name: 'name',
     *   });
     * ```
     */
    create(params: CustomCreateParams, options?: Core.RequestOptions): Core.APIPromise<ProfilesAPI.Profile>;
    /**
     * Updates a DLP custom profile.
     *
     * @example
     * ```ts
     * const profile =
     *   await client.zeroTrust.dlp.profiles.custom.update(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id', name: 'name' },
     *   );
     * ```
     */
    update(profileId: string, params: CustomUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ProfilesAPI.Profile>;
    /**
     * Deletes a DLP custom profile.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.zeroTrust.dlp.profiles.custom.delete(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(profileId: string, params: CustomDeleteParams, options?: Core.RequestOptions): Core.APIPromise<CustomDeleteResponse | null>;
    /**
     * Fetches a custom DLP profile by id.
     *
     * @example
     * ```ts
     * const profile =
     *   await client.zeroTrust.dlp.profiles.custom.get(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(profileId: string, params: CustomGetParams, options?: Core.RequestOptions): Core.APIPromise<ProfilesAPI.Profile>;
}
export interface CustomProfile {
    /**
     * The id of the profile (uuid).
     */
    id: string;
    /**
     * Related DLP policies will trigger when the match count exceeds the number set.
     */
    allowed_match_count: number;
    /**
     * Scan the context of predefined entries to only return matches surrounded by
     * keywords.
     */
    context_awareness: ProfilesAPI.ContextAwareness;
    /**
     * When the profile was created.
     */
    created_at: string;
    entries: Array<CustomProfile.CustomEntry | CustomProfile.PredefinedEntry | CustomProfile.IntegrationEntry | CustomProfile.ExactDataEntry | CustomProfile.DocumentFingerprintEntry | CustomProfile.WordListEntry>;
    /**
     * The name of the profile.
     */
    name: string;
    ocr_enabled: boolean;
    /**
     * When the profile was lasted updated.
     */
    updated_at: string;
    ai_context_enabled?: boolean;
    confidence_threshold?: 'low' | 'medium' | 'high' | 'very_high';
    /**
     * The description of the profile.
     */
    description?: string | null;
}
export declare namespace CustomProfile {
    interface CustomEntry {
        id: string;
        created_at: string;
        enabled: boolean;
        name: string;
        pattern: CustomAPI.Pattern;
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
export interface Pattern {
    regex: string;
    /**
     * @deprecated
     */
    validation?: 'luhn';
}
export interface PatternParam {
    regex: string;
    /**
     * @deprecated
     */
    validation?: 'luhn';
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
    entries: Array<CustomCreateParams.DLPNewCustomEntry | CustomCreateParams.DLPNewWordListEntry>;
    /**
     * Body param:
     */
    name: string;
    /**
     * Body param:
     */
    ai_context_enabled?: boolean;
    /**
     * Body param: Related DLP policies will trigger when the match count exceeds the
     * number set.
     */
    allowed_match_count?: number;
    /**
     * Body param:
     */
    confidence_threshold?: string | null;
    /**
     * Body param: Scan the context of predefined entries to only return matches
     * surrounded by keywords.
     */
    context_awareness?: ProfilesAPI.ContextAwarenessParam;
    /**
     * Body param: The description of the profile.
     */
    description?: string | null;
    /**
     * Body param:
     */
    ocr_enabled?: boolean;
    /**
     * Body param: Entries from other profiles (e.g. pre-defined Cloudflare profiles,
     * or your Microsoft Information Protection profiles).
     */
    shared_entries?: Array<CustomCreateParams.Custom | CustomCreateParams.Predefined | CustomCreateParams.Integration | CustomCreateParams.ExactData | CustomCreateParams.UnionMember4>;
}
export declare namespace CustomCreateParams {
    interface DLPNewCustomEntry {
        enabled: boolean;
        name: string;
        pattern: CustomAPI.PatternParam;
    }
    interface DLPNewWordListEntry {
        enabled: boolean;
        name: string;
        words: Array<string>;
    }
    interface Custom {
        enabled: boolean;
        entry_id: string;
        entry_type: 'custom';
    }
    interface Predefined {
        enabled: boolean;
        entry_id: string;
        entry_type: 'predefined';
    }
    interface Integration {
        enabled: boolean;
        entry_id: string;
        entry_type: 'integration';
    }
    interface ExactData {
        enabled: boolean;
        entry_id: string;
        entry_type: 'exact_data';
    }
    interface UnionMember4 {
        enabled: boolean;
        entry_id: string;
        entry_type: 'document_fingerprint';
    }
}
export interface CustomUpdateParams {
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
    ai_context_enabled?: boolean;
    /**
     * Body param:
     */
    allowed_match_count?: number | null;
    /**
     * Body param:
     */
    confidence_threshold?: string | null;
    /**
     * Body param: Scan the context of predefined entries to only return matches
     * surrounded by keywords.
     */
    context_awareness?: ProfilesAPI.ContextAwarenessParam;
    /**
     * Body param: The description of the profile.
     */
    description?: string | null;
    /**
     * @deprecated Body param: Custom entries from this profile. If this field is
     * omitted, entries owned by this profile will not be changed.
     */
    entries?: Array<CustomUpdateParams.DLPNewCustomEntryWithID | CustomUpdateParams.DLPNewCustomEntry> | null;
    /**
     * Body param:
     */
    ocr_enabled?: boolean;
    /**
     * Body param: Other entries, e.g. predefined or integration.
     */
    shared_entries?: Array<CustomUpdateParams.Predefined | CustomUpdateParams.Integration | CustomUpdateParams.ExactData | CustomUpdateParams.UnionMember3>;
}
export declare namespace CustomUpdateParams {
    interface DLPNewCustomEntryWithID {
        enabled: boolean;
        entry_id: string;
        name: string;
        pattern: CustomAPI.PatternParam;
    }
    interface DLPNewCustomEntry {
        enabled: boolean;
        name: string;
        pattern: CustomAPI.PatternParam;
    }
    interface Predefined {
        enabled: boolean;
        entry_id: string;
        entry_type: 'predefined';
    }
    interface Integration {
        enabled: boolean;
        entry_id: string;
        entry_type: 'integration';
    }
    interface ExactData {
        enabled: boolean;
        entry_id: string;
        entry_type: 'exact_data';
    }
    interface UnionMember3 {
        enabled: boolean;
        entry_id: string;
        entry_type: 'document_fingerprint';
    }
}
export interface CustomDeleteParams {
    account_id: string;
}
export interface CustomGetParams {
    account_id: string;
}
export declare namespace Custom {
    export { type CustomProfile as CustomProfile, type Pattern as Pattern, type CustomDeleteResponse as CustomDeleteResponse, type CustomCreateParams as CustomCreateParams, type CustomUpdateParams as CustomUpdateParams, type CustomDeleteParams as CustomDeleteParams, type CustomGetParams as CustomGetParams, };
}
//# sourceMappingURL=custom.d.ts.map