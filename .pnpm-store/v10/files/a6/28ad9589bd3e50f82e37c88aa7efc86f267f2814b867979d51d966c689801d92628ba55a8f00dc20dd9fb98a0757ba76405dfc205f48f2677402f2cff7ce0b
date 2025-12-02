// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as AddressesAPI from "./addresses.mjs";
import { Addresses, AddressesV4PagePaginationArray, } from "./addresses.mjs";
import * as DNSAPI from "./dns.mjs";
import { DNS, DNSRecordsSinglePage, } from "./dns.mjs";
import * as RulesAPI from "./rules/rules.mjs";
import { EmailRoutingRulesV4PagePaginationArray, Rules, } from "./rules/rules.mjs";
export class EmailRouting extends APIResource {
    constructor() {
        super(...arguments);
        this.dns = new DNSAPI.DNS(this._client);
        this.rules = new RulesAPI.Rules(this._client);
        this.addresses = new AddressesAPI.Addresses(this._client);
    }
    /**
     * Disable your Email Routing zone. Also removes additional MX records previously
     * required for Email Routing to work.
     *
     * @deprecated
     */
    disable(params, options) {
        const { zone_id, body } = params;
        return this._client.post(`/zones/${zone_id}/email/routing/disable`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Enable you Email Routing zone. Add and lock the necessary MX and SPF records.
     *
     * @deprecated
     */
    enable(params, options) {
        const { zone_id, body } = params;
        return this._client.post(`/zones/${zone_id}/email/routing/enable`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/email/routing`, options)._thenUnwrap((obj) => obj.result);
    }
}
EmailRouting.DNS = DNS;
EmailRouting.DNSRecordsSinglePage = DNSRecordsSinglePage;
EmailRouting.Rules = Rules;
EmailRouting.EmailRoutingRulesV4PagePaginationArray = EmailRoutingRulesV4PagePaginationArray;
EmailRouting.Addresses = Addresses;
EmailRouting.AddressesV4PagePaginationArray = AddressesV4PagePaginationArray;
//# sourceMappingURL=email-routing.mjs.map