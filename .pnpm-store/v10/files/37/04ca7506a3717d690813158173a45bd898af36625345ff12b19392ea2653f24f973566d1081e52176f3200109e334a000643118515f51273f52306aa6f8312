// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class DNS extends APIResource {
    /**
     * Enable you Email Routing zone. Add and lock the necessary MX and SPF records.
     *
     * @example
     * ```ts
     * const settings = await client.emailRouting.dns.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'example.net',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/email/routing/dns`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Disable your Email Routing zone. Also removes additional MX records previously
     * required for Email Routing to work.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const dnsRecord of client.emailRouting.dns.delete(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/email/routing/dns`, DNSRecordsSinglePage, {
            method: 'delete',
            ...options,
        });
    }
    /**
     * Unlock MX Records previously locked by Email Routing.
     *
     * @example
     * ```ts
     * const settings = await client.emailRouting.dns.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'example.net',
     * });
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/email/routing/dns`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Show the DNS records needed to configure your Email Routing zone.
     *
     * @example
     * ```ts
     * const dns = await client.emailRouting.dns.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/email/routing/dns`, { query, ...options });
    }
}
export class DNSRecordsSinglePage extends SinglePage {
}
DNS.DNSRecordsSinglePage = DNSRecordsSinglePage;
//# sourceMappingURL=dns.mjs.map