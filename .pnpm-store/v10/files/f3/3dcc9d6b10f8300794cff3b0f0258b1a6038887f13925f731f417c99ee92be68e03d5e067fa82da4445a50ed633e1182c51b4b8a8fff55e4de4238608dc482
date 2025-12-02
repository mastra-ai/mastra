// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as Core from "../../core.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Records extends APIResource {
    /**
     * Create a new DNS record for a zone.
     *
     * Notes:
     *
     * - A/AAAA records cannot exist on the same name as CNAME records.
     * - NS records cannot exist on the same name as any other record type.
     * - Domain names are always represented in Punycode, even if Unicode characters
     *   were used when creating the record.
     *
     * @example
     * ```ts
     * const recordResponse = await client.dns.records.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'example.com',
     *   ttl: 3600,
     *   type: 'A',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/dns_records`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Overwrite an existing DNS record.
     *
     * Notes:
     *
     * - A/AAAA records cannot exist on the same name as CNAME records.
     * - NS records cannot exist on the same name as any other record type.
     * - Domain names are always represented in Punycode, even if Unicode characters
     *   were used when creating the record.
     *
     * @example
     * ```ts
     * const recordResponse = await client.dns.records.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'example.com',
     *     ttl: 3600,
     *     type: 'A',
     *   },
     * );
     * ```
     */
    update(dnsRecordId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/dns_records/${dnsRecordId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List, search, sort, and filter a zones' DNS records.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const recordResponse of client.dns.records.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/dns_records`, RecordResponsesV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Delete DNS Record
     *
     * @example
     * ```ts
     * const record = await client.dns.records.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(dnsRecordId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/dns_records/${dnsRecordId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Send a Batch of DNS Record API calls to be executed together.
     *
     * Notes:
     *
     * - Although Cloudflare will execute the batched operations in a single database
     *   transaction, Cloudflare's distributed KV store must treat each record change
     *   as a single key-value pair. This means that the propagation of changes is not
     *   atomic. See
     *   [the documentation](https://developers.cloudflare.com/dns/manage-dns-records/how-to/batch-record-changes/ "Batch DNS records")
     *   for more information.
     * - The operations you specify within the /batch request body are always executed
     *   in the following order:
     *
     *   - Deletes
     *   - Patches
     *   - Puts
     *   - Posts
     *
     * @example
     * ```ts
     * const response = await client.dns.records.batch({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    batch(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/dns_records/batch`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update an existing DNS record.
     *
     * Notes:
     *
     * - A/AAAA records cannot exist on the same name as CNAME records.
     * - NS records cannot exist on the same name as any other record type.
     * - Domain names are always represented in Punycode, even if Unicode characters
     *   were used when creating the record.
     *
     * @example
     * ```ts
     * const recordResponse = await client.dns.records.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'example.com',
     *     ttl: 3600,
     *     type: 'A',
     *   },
     * );
     * ```
     */
    edit(dnsRecordId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/dns_records/${dnsRecordId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * You can export your
     * [BIND config](https://en.wikipedia.org/wiki/Zone_file "Zone file") through this
     * endpoint.
     *
     * See
     * [the documentation](https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/ "Import and export records")
     * for more information.
     *
     * @example
     * ```ts
     * const response = await client.dns.records.export({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    export(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/dns_records/export`, {
            ...options,
            headers: { Accept: 'text/plain', ...options?.headers },
        });
    }
    /**
     * DNS Record Details
     *
     * @example
     * ```ts
     * const recordResponse = await client.dns.records.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(dnsRecordId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/dns_records/${dnsRecordId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * You can upload your
     * [BIND config](https://en.wikipedia.org/wiki/Zone_file "Zone file") through this
     * endpoint. It assumes that cURL is called from a location with bind_config.txt
     * (valid BIND config) present.
     *
     * See
     * [the documentation](https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/ "Import and export records")
     * for more information.
     *
     * @example
     * ```ts
     * const response = await client.dns.records.import({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   file: 'www.example.com. 300 IN  A 127.0.0.1',
     * });
     * ```
     */
    import(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/dns_records/import`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Scan for common DNS records on your domain and automatically add them to your
     * zone. Useful if you haven't updated your nameservers yet.
     *
     * @example
     * ```ts
     * const response = await client.dns.records.scan({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   body: {},
     * });
     * ```
     */
    scan(params, options) {
        const { zone_id, body } = params;
        return this._client.post(`/zones/${zone_id}/dns_records/scan`, { body: body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
export class RecordResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Records.RecordResponsesV4PagePaginationArray = RecordResponsesV4PagePaginationArray;
//# sourceMappingURL=records.mjs.map