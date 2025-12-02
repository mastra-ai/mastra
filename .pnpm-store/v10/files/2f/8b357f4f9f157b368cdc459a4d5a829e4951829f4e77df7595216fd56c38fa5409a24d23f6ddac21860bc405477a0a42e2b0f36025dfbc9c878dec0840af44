import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Logging extends APIResource {
    /**
     * Updates logging settings for the current Zero Trust account.
     *
     * @example
     * ```ts
     * const loggingSetting =
     *   await client.zeroTrust.gateway.logging.update({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    update(params: LoggingUpdateParams, options?: Core.RequestOptions): Core.APIPromise<LoggingSetting>;
    /**
     * Fetches the current logging settings for Zero Trust account.
     *
     * @example
     * ```ts
     * const loggingSetting =
     *   await client.zeroTrust.gateway.logging.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params: LoggingGetParams, options?: Core.RequestOptions): Core.APIPromise<LoggingSetting>;
}
export interface LoggingSetting {
    /**
     * Redact personally identifiable information from activity logging (PII fields
     * are: source IP, user email, user ID, device ID, URL, referrer, user agent).
     */
    redact_pii?: boolean;
    /**
     * Logging settings by rule type.
     */
    settings_by_rule_type?: LoggingSetting.SettingsByRuleType;
}
export declare namespace LoggingSetting {
    /**
     * Logging settings by rule type.
     */
    interface SettingsByRuleType {
        dns?: SettingsByRuleType.DNS;
        http?: SettingsByRuleType.HTTP;
        l4?: SettingsByRuleType.L4;
    }
    namespace SettingsByRuleType {
        interface DNS {
            /**
             * Log all requests to this service.
             */
            log_all?: boolean;
            /**
             * Log only blocking requests to this service.
             */
            log_blocks?: boolean;
        }
        interface HTTP {
            /**
             * Log all requests to this service.
             */
            log_all?: boolean;
            /**
             * Log only blocking requests to this service.
             */
            log_blocks?: boolean;
        }
        interface L4 {
            /**
             * Log all requests to this service.
             */
            log_all?: boolean;
            /**
             * Log only blocking requests to this service.
             */
            log_blocks?: boolean;
        }
    }
}
export interface LoggingUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: Redact personally identifiable information from activity logging
     * (PII fields are: source IP, user email, user ID, device ID, URL, referrer, user
     * agent).
     */
    redact_pii?: boolean;
    /**
     * Body param: Logging settings by rule type.
     */
    settings_by_rule_type?: LoggingUpdateParams.SettingsByRuleType;
}
export declare namespace LoggingUpdateParams {
    /**
     * Logging settings by rule type.
     */
    interface SettingsByRuleType {
        dns?: SettingsByRuleType.DNS;
        http?: SettingsByRuleType.HTTP;
        l4?: SettingsByRuleType.L4;
    }
    namespace SettingsByRuleType {
        interface DNS {
            /**
             * Log all requests to this service.
             */
            log_all?: boolean;
            /**
             * Log only blocking requests to this service.
             */
            log_blocks?: boolean;
        }
        interface HTTP {
            /**
             * Log all requests to this service.
             */
            log_all?: boolean;
            /**
             * Log only blocking requests to this service.
             */
            log_blocks?: boolean;
        }
        interface L4 {
            /**
             * Log all requests to this service.
             */
            log_all?: boolean;
            /**
             * Log only blocking requests to this service.
             */
            log_blocks?: boolean;
        }
    }
}
export interface LoggingGetParams {
    account_id: string;
}
export declare namespace Logging {
    export { type LoggingSetting as LoggingSetting, type LoggingUpdateParams as LoggingUpdateParams, type LoggingGetParams as LoggingGetParams, };
}
//# sourceMappingURL=logging.d.ts.map