import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as AddressesAPI from "./addresses.js";
import { Address, AddressCreateParams, AddressDeleteParams, AddressGetParams, AddressListParams, Addresses, AddressesV4PagePaginationArray } from "./addresses.js";
import * as DNSAPI from "./dns.js";
import { DNS, DNSCreateParams, DNSDeleteParams, DNSEditParams, DNSGetParams, DNSGetResponse, DNSRecord, DNSRecordsSinglePage } from "./dns.js";
import * as RulesAPI from "./rules/rules.js";
import { Action, EmailRoutingRule, EmailRoutingRulesV4PagePaginationArray, Matcher, RuleCreateParams, RuleDeleteParams, RuleGetParams, RuleListParams, RuleUpdateParams, Rules } from "./rules/rules.js";
export declare class EmailRouting extends APIResource {
    dns: DNSAPI.DNS;
    rules: RulesAPI.Rules;
    addresses: AddressesAPI.Addresses;
    /**
     * Disable your Email Routing zone. Also removes additional MX records previously
     * required for Email Routing to work.
     *
     * @deprecated
     */
    disable(params: EmailRoutingDisableParams, options?: Core.RequestOptions): Core.APIPromise<Settings>;
    /**
     * Enable you Email Routing zone. Add and lock the necessary MX and SPF records.
     *
     * @deprecated
     */
    enable(params: EmailRoutingEnableParams, options?: Core.RequestOptions): Core.APIPromise<Settings>;
    /**
     * Get information about the settings for your Email Routing zone.
     *
     * @example
     * ```ts
     * const settings = await client.emailRouting.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: EmailRoutingGetParams, options?: Core.RequestOptions): Core.APIPromise<Settings>;
}
export interface Settings {
    /**
     * Email Routing settings identifier.
     */
    id: string;
    /**
     * State of the zone settings for Email Routing.
     */
    enabled: true | false;
    /**
     * Domain of your zone.
     */
    name: string;
    /**
     * The date and time the settings have been created.
     */
    created?: string;
    /**
     * The date and time the settings have been modified.
     */
    modified?: string;
    /**
     * Flag to check if the user skipped the configuration wizard.
     */
    skip_wizard?: true | false;
    /**
     * Show the state of your account, and the type or configuration error.
     */
    status?: 'ready' | 'unconfigured' | 'misconfigured' | 'misconfigured/locked' | 'unlocked';
    /**
     * @deprecated Email Routing settings tag. (Deprecated, replaced by Email Routing
     * settings identifier)
     */
    tag?: string;
}
export interface EmailRoutingDisableParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export interface EmailRoutingEnableParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export interface EmailRoutingGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace EmailRouting {
    export { type Settings as Settings, type EmailRoutingDisableParams as EmailRoutingDisableParams, type EmailRoutingEnableParams as EmailRoutingEnableParams, type EmailRoutingGetParams as EmailRoutingGetParams, };
    export { DNS as DNS, type DNSRecord as DNSRecord, type DNSGetResponse as DNSGetResponse, DNSRecordsSinglePage as DNSRecordsSinglePage, type DNSCreateParams as DNSCreateParams, type DNSDeleteParams as DNSDeleteParams, type DNSEditParams as DNSEditParams, type DNSGetParams as DNSGetParams, };
    export { Rules as Rules, type Action as Action, type EmailRoutingRule as EmailRoutingRule, type Matcher as Matcher, EmailRoutingRulesV4PagePaginationArray as EmailRoutingRulesV4PagePaginationArray, type RuleCreateParams as RuleCreateParams, type RuleUpdateParams as RuleUpdateParams, type RuleListParams as RuleListParams, type RuleDeleteParams as RuleDeleteParams, type RuleGetParams as RuleGetParams, };
    export { Addresses as Addresses, type Address as Address, AddressesV4PagePaginationArray as AddressesV4PagePaginationArray, type AddressCreateParams as AddressCreateParams, type AddressListParams as AddressListParams, type AddressDeleteParams as AddressDeleteParams, type AddressGetParams as AddressGetParams, };
}
//# sourceMappingURL=email-routing.d.ts.map