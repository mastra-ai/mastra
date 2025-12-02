import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as ProfilesAPI from "./profiles.js";
import * as CustomAPI from "./custom.js";
import { Custom, CustomCreateParams, CustomDeleteParams, CustomDeleteResponse, CustomGetParams, CustomProfile as CustomAPICustomProfile, CustomUpdateParams, Pattern } from "./custom.js";
import * as PredefinedAPI from "./predefined.js";
import { Predefined, PredefinedCreateParams, PredefinedDeleteParams, PredefinedDeleteResponse, PredefinedGetParams, PredefinedProfile as PredefinedAPIPredefinedProfile, PredefinedUpdateParams } from "./predefined.js";
import { SinglePage } from "../../../../pagination.js";
export declare class Profiles extends APIResource {
    custom: CustomAPI.Custom;
    predefined: PredefinedAPI.Predefined;
    /**
     * Lists all DLP profiles in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const profile of client.zeroTrust.dlp.profiles.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: ProfileListParams, options?: Core.RequestOptions): Core.PagePromise<ProfilesSinglePage, Profile>;
    /**
     * Fetches a DLP profile by ID.
     *
     * @example
     * ```ts
     * const profile = await client.zeroTrust.dlp.profiles.get(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(profileId: string, params: ProfileGetParams, options?: Core.RequestOptions): Core.APIPromise<Profile>;
}
export declare class ProfilesSinglePage extends SinglePage<Profile> {
}
/**
 * Scan the context of predefined entries to only return matches surrounded by
 * keywords.
 */
export interface ContextAwareness {
    /**
     * If true, scan the context of predefined entries to only return matches
     * surrounded by keywords.
     */
    enabled: boolean;
    /**
     * Content types to exclude from context analysis and return all matches.
     */
    skip: SkipConfiguration;
}
/**
 * Scan the context of predefined entries to only return matches surrounded by
 * keywords.
 */
export interface ContextAwarenessParam {
    /**
     * If true, scan the context of predefined entries to only return matches
     * surrounded by keywords.
     */
    enabled: boolean;
    /**
     * Content types to exclude from context analysis and return all matches.
     */
    skip: SkipConfigurationParam;
}
export type Profile = Profile.CustomProfile | Profile.PredefinedProfile | Profile.IntegrationProfile;
export declare namespace Profile {
    interface CustomProfile {
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
        type: 'custom';
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
    namespace CustomProfile {
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
    interface PredefinedProfile {
        /**
         * The id of the predefined profile (uuid).
         */
        id: string;
        allowed_match_count: number;
        entries: Array<PredefinedProfile.CustomEntry | PredefinedProfile.PredefinedEntry | PredefinedProfile.IntegrationEntry | PredefinedProfile.ExactDataEntry | PredefinedProfile.DocumentFingerprintEntry | PredefinedProfile.WordListEntry>;
        /**
         * The name of the predefined profile.
         */
        name: string;
        type: 'predefined';
        ai_context_enabled?: boolean;
        confidence_threshold?: 'low' | 'medium' | 'high' | 'very_high';
        /**
         * Scan the context of predefined entries to only return matches surrounded by
         * keywords.
         */
        context_awareness?: ProfilesAPI.ContextAwareness;
        ocr_enabled?: boolean;
        /**
         * Whether this profile can be accessed by anyone.
         */
        open_access?: boolean;
    }
    namespace PredefinedProfile {
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
    interface IntegrationProfile {
        id: string;
        created_at: string;
        entries: Array<IntegrationProfile.CustomEntry | IntegrationProfile.PredefinedEntry | IntegrationProfile.IntegrationEntry | IntegrationProfile.ExactDataEntry | IntegrationProfile.DocumentFingerprintEntry | IntegrationProfile.WordListEntry>;
        name: string;
        type: 'integration';
        updated_at: string;
        /**
         * The description of the profile.
         */
        description?: string | null;
    }
    namespace IntegrationProfile {
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
}
/**
 * Content types to exclude from context analysis and return all matches.
 */
export interface SkipConfiguration {
    /**
     * If the content type is a file, skip context analysis and return all matches.
     */
    files: boolean;
}
/**
 * Content types to exclude from context analysis and return all matches.
 */
export interface SkipConfigurationParam {
    /**
     * If the content type is a file, skip context analysis and return all matches.
     */
    files: boolean;
}
export interface ProfileListParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Query param: Return all profiles, including those that current account does not
     * have access to.
     */
    all?: boolean;
}
export interface ProfileGetParams {
    account_id: string;
}
export declare namespace Profiles {
    export { type ContextAwareness as ContextAwareness, type Profile as Profile, type SkipConfiguration as SkipConfiguration, ProfilesSinglePage as ProfilesSinglePage, type ProfileListParams as ProfileListParams, type ProfileGetParams as ProfileGetParams, };
    export { Custom as Custom, type CustomAPICustomProfile as CustomProfile, type Pattern as Pattern, type CustomDeleteResponse as CustomDeleteResponse, type CustomCreateParams as CustomCreateParams, type CustomUpdateParams as CustomUpdateParams, type CustomDeleteParams as CustomDeleteParams, type CustomGetParams as CustomGetParams, };
    export { Predefined as Predefined, type PredefinedAPIPredefinedProfile as PredefinedProfile, type PredefinedDeleteResponse as PredefinedDeleteResponse, type PredefinedCreateParams as PredefinedCreateParams, type PredefinedUpdateParams as PredefinedUpdateParams, type PredefinedDeleteParams as PredefinedDeleteParams, type PredefinedGetParams as PredefinedGetParams, };
}
//# sourceMappingURL=profiles.d.ts.map