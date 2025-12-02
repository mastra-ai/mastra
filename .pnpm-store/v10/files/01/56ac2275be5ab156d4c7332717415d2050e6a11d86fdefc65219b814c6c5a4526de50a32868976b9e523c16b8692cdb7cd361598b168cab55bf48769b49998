import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as LogoMatchesAPI from "./logo-matches.js";
import { LogoMatches } from "./logo-matches.js";
import * as LogosAPI from "./logos.js";
import { Logos } from "./logos.js";
import * as MatchesAPI from "./matches.js";
import { Matches } from "./matches.js";
import * as QueriesAPI from "./queries.js";
import { Queries } from "./queries.js";
export declare class BrandProtection extends APIResource {
    queries: QueriesAPI.Queries;
    matches: MatchesAPI.Matches;
    logos: LogosAPI.Logos;
    logoMatches: LogoMatchesAPI.LogoMatches;
    /**
     * Submit suspicious URL for scanning.
     *
     * @example
     * ```ts
     * const submit = await client.brandProtection.submit({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    submit(params: BrandProtectionSubmitParams, options?: Core.RequestOptions): Core.APIPromise<Submit>;
    /**
     * Gets phishing details about a URL.
     *
     * @example
     * ```ts
     * const info = await client.brandProtection.urlInfo({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    urlInfo(params: BrandProtectionURLInfoParams, options?: Core.RequestOptions): Core.APIPromise<Info>;
}
export interface Info {
    /**
     * List of categorizations applied to this submission.
     */
    categorizations?: Array<Info.Categorization>;
    /**
     * List of model results for completed scans.
     */
    model_results?: Array<URLInfoModelResults>;
    /**
     * List of signatures that matched against site content found when crawling the
     * URL.
     */
    rule_matches?: Array<RuleMatch>;
    /**
     * Status of the most recent scan found.
     */
    scan_status?: ScanStatus;
    /**
     * For internal use.
     */
    screenshot_download_signature?: string;
    /**
     * For internal use.
     */
    screenshot_path?: string;
    /**
     * URL that was submitted.
     */
    url?: string;
}
export declare namespace Info {
    interface Categorization {
        /**
         * Name of the category applied.
         */
        category?: string;
        /**
         * Result of human review for this categorization.
         */
        verification_status?: string;
    }
}
export interface RuleMatch {
    /**
     * For internal use.
     */
    banning?: boolean;
    /**
     * For internal use.
     */
    blocking?: boolean;
    /**
     * Description of the signature that matched.
     */
    description?: string;
    /**
     * Name of the signature that matched.
     */
    name?: string;
}
/**
 * Status of the most recent scan found.
 */
export interface ScanStatus {
    /**
     * Timestamp of when the submission was processed.
     */
    last_processed?: string;
    /**
     * For internal use.
     */
    scan_complete?: boolean;
    /**
     * Status code that the crawler received when loading the submitted URL.
     */
    status_code?: number;
    /**
     * ID of the most recent submission.
     */
    submission_id?: number;
}
export interface Submit {
    /**
     * URLs that were excluded from scanning because their domain is in our no-scan
     * list.
     */
    excluded_urls?: Array<Submit.ExcludedURL>;
    /**
     * URLs that were skipped because the same URL is currently being scanned.
     */
    skipped_urls?: Array<Submit.SkippedURL>;
    /**
     * URLs that were successfully submitted for scanning.
     */
    submitted_urls?: Array<Submit.SubmittedURL>;
}
export declare namespace Submit {
    interface ExcludedURL {
        /**
         * URL that was excluded.
         */
        url?: string;
    }
    interface SkippedURL {
        /**
         * URL that was skipped.
         */
        url?: string;
        /**
         * ID of the submission of that URL that is currently scanning.
         */
        url_id?: number;
    }
    interface SubmittedURL {
        /**
         * URL that was submitted.
         */
        url?: string;
        /**
         * ID assigned to this URL submission. Used to retrieve scanning results.
         */
        url_id?: number;
    }
}
export interface URLInfoModelResults {
    /**
     * Name of the model.
     */
    model_name?: string;
    /**
     * This is the score that is outputted by the model for this submission.
     */
    model_score?: number;
}
export interface BrandProtectionSubmitParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: URL(s) to filter submissions results by.
     */
    url?: string;
}
export interface BrandProtectionURLInfoParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Query param: Submission URL(s) to filter submission results by.
     */
    url?: Array<string>;
    /**
     * Query param: Submission ID(s) to filter submission results by.
     */
    url_id?: Array<number>;
}
export declare namespace BrandProtection {
    export { type Info as Info, type RuleMatch as RuleMatch, type ScanStatus as ScanStatus, type Submit as Submit, type URLInfoModelResults as URLInfoModelResults, type BrandProtectionSubmitParams as BrandProtectionSubmitParams, type BrandProtectionURLInfoParams as BrandProtectionURLInfoParams, };
    export { Queries as Queries };
    export { Matches as Matches };
    export { Logos as Logos };
    export { LogoMatches as LogoMatches };
}
//# sourceMappingURL=brand-protection.d.ts.map