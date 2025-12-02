// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as RecordsAPI from './records';
import * as Shared from '../shared';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

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
  create(params: RecordCreateParams, options?: Core.RequestOptions): Core.APIPromise<RecordResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/dns_records`, { body, ...options }) as Core.APIPromise<{
        result: RecordResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
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
  update(
    dnsRecordId: string,
    params: RecordUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RecordResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/dns_records/${dnsRecordId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RecordResponse }>
    )._thenUnwrap((obj) => obj.result);
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
  list(
    params: RecordListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<RecordResponsesV4PagePaginationArray, RecordResponse> {
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
  delete(
    dnsRecordId: string,
    params: RecordDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RecordDeleteResponse> {
    const { zone_id } = params;
    return (
      this._client.delete(`/zones/${zone_id}/dns_records/${dnsRecordId}`, options) as Core.APIPromise<{
        result: RecordDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
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
  batch(params: RecordBatchParams, options?: Core.RequestOptions): Core.APIPromise<RecordBatchResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/dns_records/batch`, { body, ...options }) as Core.APIPromise<{
        result: RecordBatchResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
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
  edit(
    dnsRecordId: string,
    params: RecordEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RecordResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/dns_records/${dnsRecordId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RecordResponse }>
    )._thenUnwrap((obj) => obj.result);
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
  export(params: RecordExportParams, options?: Core.RequestOptions): Core.APIPromise<string> {
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
  get(
    dnsRecordId: string,
    params: RecordGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RecordResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/dns_records/${dnsRecordId}`, options) as Core.APIPromise<{
        result: RecordResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
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
  import(params: RecordImportParams, options?: Core.RequestOptions): Core.APIPromise<RecordImportResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(
        `/zones/${zone_id}/dns_records/import`,
        Core.multipartFormRequestOptions({ body, ...options }),
      ) as Core.APIPromise<{ result: RecordImportResponse }>
    )._thenUnwrap((obj) => obj.result);
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
  scan(params: RecordScanParams, options?: Core.RequestOptions): Core.APIPromise<RecordScanResponse> {
    const { zone_id, body } = params;
    return (
      this._client.post(`/zones/${zone_id}/dns_records/scan`, { body: body, ...options }) as Core.APIPromise<{
        result: RecordScanResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class RecordResponsesV4PagePaginationArray extends V4PagePaginationArray<RecordResponse> {}

export interface ARecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'A';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * A valid IPv4 address.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: ARecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace ARecord {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface ARecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'A';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * A valid IPv4 address.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: ARecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace ARecordParam {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface AAAARecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'AAAA';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * A valid IPv6 address.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: AAAARecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace AAAARecord {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface AAAARecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'AAAA';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * A valid IPv6 address.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: AAAARecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace AAAARecordParam {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export type BatchPatch =
  | BatchPatch.ARecord
  | BatchPatch.AAAARecord
  | BatchPatch.CNAMERecord
  | BatchPatch.MXRecord
  | BatchPatch.NSRecord
  | BatchPatch.OpenpgpkeyRecord
  | BatchPatch.PTRRecord
  | BatchPatch.TXTRecord
  | BatchPatch.CAARecord
  | BatchPatch.CERTRecord
  | BatchPatch.DNSKEYRecord
  | BatchPatch.DSRecord
  | BatchPatch.HTTPSRecord
  | BatchPatch.LOCRecord
  | BatchPatch.NAPTRRecord
  | BatchPatch.SMIMEARecord
  | BatchPatch.SRVRecord
  | BatchPatch.SSHFPRecord
  | BatchPatch.SVCBRecord
  | BatchPatch.TLSARecord
  | BatchPatch.URIRecord;

export namespace BatchPatch {
  export interface ARecord extends RecordsAPI.ARecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface AAAARecord extends RecordsAPI.AAAARecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CNAMERecord extends RecordsAPI.CNAMERecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface MXRecord extends RecordsAPI.MXRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface NSRecord extends RecordsAPI.NSRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface OpenpgpkeyRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
     * Value must be between 60 and 86400, with the minimum reduced to 30 for
     * Enterprise zones.
     */
    ttl: RecordsAPI.TTL;

    /**
     * Record type.
     */
    type: 'OPENPGPKEY';

    /**
     * Comments or notes about the DNS record. This field has no effect on DNS
     * responses.
     */
    comment?: string;

    /**
     * A single Base64-encoded OpenPGP Transferable Public Key (RFC 4880 Section 11.1)
     */
    content?: string;

    /**
     * Whether the record is receiving the performance and security benefits of
     * Cloudflare.
     */
    proxied?: boolean;

    /**
     * Settings for the DNS record.
     */
    settings?: OpenpgpkeyRecord.Settings;

    /**
     * Custom tags for the DNS record. This field has no effect on DNS responses.
     */
    tags?: Array<RecordsAPI.RecordTags>;
  }

  export namespace OpenpgpkeyRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface PTRRecord extends RecordsAPI.PTRRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface TXTRecord extends RecordsAPI.TXTRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CAARecord extends RecordsAPI.CAARecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CERTRecord extends RecordsAPI.CERTRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface DNSKEYRecord extends RecordsAPI.DNSKEYRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface DSRecord extends RecordsAPI.DSRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface HTTPSRecord extends RecordsAPI.HTTPSRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface LOCRecord extends RecordsAPI.LOCRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface NAPTRRecord extends RecordsAPI.NAPTRRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SMIMEARecord extends RecordsAPI.SMIMEARecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SRVRecord extends RecordsAPI.SRVRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SSHFPRecord extends RecordsAPI.SSHFPRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SVCBRecord extends RecordsAPI.SVCBRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface TLSARecord extends RecordsAPI.TLSARecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface URIRecord extends RecordsAPI.URIRecord {
    /**
     * Identifier.
     */
    id: string;
  }
}

export type BatchPatchParam =
  | BatchPatchParam.ARecord
  | BatchPatchParam.AAAARecord
  | BatchPatchParam.CNAMERecord
  | BatchPatchParam.MXRecord
  | BatchPatchParam.NSRecord
  | BatchPatchParam.OpenpgpkeyRecord
  | BatchPatchParam.PTRRecord
  | BatchPatchParam.TXTRecord
  | BatchPatchParam.CAARecord
  | BatchPatchParam.CERTRecord
  | BatchPatchParam.DNSKEYRecord
  | BatchPatchParam.DSRecord
  | BatchPatchParam.HTTPSRecord
  | BatchPatchParam.LOCRecord
  | BatchPatchParam.NAPTRRecord
  | BatchPatchParam.SMIMEARecord
  | BatchPatchParam.SRVRecord
  | BatchPatchParam.SSHFPRecord
  | BatchPatchParam.SVCBRecord
  | BatchPatchParam.TLSARecord
  | BatchPatchParam.URIRecord;

export namespace BatchPatchParam {
  export interface ARecord extends RecordsAPI.ARecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface AAAARecord extends RecordsAPI.AAAARecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CNAMERecord extends RecordsAPI.CNAMERecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface MXRecord extends RecordsAPI.MXRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface NSRecord extends RecordsAPI.NSRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface OpenpgpkeyRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
     * Value must be between 60 and 86400, with the minimum reduced to 30 for
     * Enterprise zones.
     */
    ttl: RecordsAPI.TTLParam;

    /**
     * Record type.
     */
    type: 'OPENPGPKEY';

    /**
     * Comments or notes about the DNS record. This field has no effect on DNS
     * responses.
     */
    comment?: string;

    /**
     * A single Base64-encoded OpenPGP Transferable Public Key (RFC 4880 Section 11.1)
     */
    content?: string;

    /**
     * Whether the record is receiving the performance and security benefits of
     * Cloudflare.
     */
    proxied?: boolean;

    /**
     * Settings for the DNS record.
     */
    settings?: OpenpgpkeyRecord.Settings;

    /**
     * Custom tags for the DNS record. This field has no effect on DNS responses.
     */
    tags?: Array<RecordsAPI.RecordTagsParam>;
  }

  export namespace OpenpgpkeyRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface PTRRecord extends RecordsAPI.PTRRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface TXTRecord extends RecordsAPI.TXTRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CAARecord extends RecordsAPI.CAARecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CERTRecord extends RecordsAPI.CERTRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface DNSKEYRecord extends RecordsAPI.DNSKEYRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface DSRecord extends RecordsAPI.DSRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface HTTPSRecord extends RecordsAPI.HTTPSRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface LOCRecord extends RecordsAPI.LOCRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface NAPTRRecord extends RecordsAPI.NAPTRRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SMIMEARecord extends RecordsAPI.SMIMEARecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SRVRecord extends RecordsAPI.SRVRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SSHFPRecord extends RecordsAPI.SSHFPRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SVCBRecord extends RecordsAPI.SVCBRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface TLSARecord extends RecordsAPI.TLSARecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface URIRecord extends RecordsAPI.URIRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }
}

export type BatchPut =
  | BatchPut.ARecord
  | BatchPut.AAAARecord
  | BatchPut.CNAMERecord
  | BatchPut.MXRecord
  | BatchPut.NSRecord
  | BatchPut.OpenpgpkeyRecord
  | BatchPut.PTRRecord
  | BatchPut.TXTRecord
  | BatchPut.CAARecord
  | BatchPut.CERTRecord
  | BatchPut.DNSKEYRecord
  | BatchPut.DSRecord
  | BatchPut.HTTPSRecord
  | BatchPut.LOCRecord
  | BatchPut.NAPTRRecord
  | BatchPut.SMIMEARecord
  | BatchPut.SRVRecord
  | BatchPut.SSHFPRecord
  | BatchPut.SVCBRecord
  | BatchPut.TLSARecord
  | BatchPut.URIRecord;

export namespace BatchPut {
  export interface ARecord extends RecordsAPI.ARecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface AAAARecord extends RecordsAPI.AAAARecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CNAMERecord extends RecordsAPI.CNAMERecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface MXRecord extends RecordsAPI.MXRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface NSRecord extends RecordsAPI.NSRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface OpenpgpkeyRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
     * Value must be between 60 and 86400, with the minimum reduced to 30 for
     * Enterprise zones.
     */
    ttl: RecordsAPI.TTL;

    /**
     * Record type.
     */
    type: 'OPENPGPKEY';

    /**
     * Comments or notes about the DNS record. This field has no effect on DNS
     * responses.
     */
    comment?: string;

    /**
     * A single Base64-encoded OpenPGP Transferable Public Key (RFC 4880 Section 11.1)
     */
    content?: string;

    /**
     * Whether the record is receiving the performance and security benefits of
     * Cloudflare.
     */
    proxied?: boolean;

    /**
     * Settings for the DNS record.
     */
    settings?: OpenpgpkeyRecord.Settings;

    /**
     * Custom tags for the DNS record. This field has no effect on DNS responses.
     */
    tags?: Array<RecordsAPI.RecordTags>;
  }

  export namespace OpenpgpkeyRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface PTRRecord extends RecordsAPI.PTRRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface TXTRecord extends RecordsAPI.TXTRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CAARecord extends RecordsAPI.CAARecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CERTRecord extends RecordsAPI.CERTRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface DNSKEYRecord extends RecordsAPI.DNSKEYRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface DSRecord extends RecordsAPI.DSRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface HTTPSRecord extends RecordsAPI.HTTPSRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface LOCRecord extends RecordsAPI.LOCRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface NAPTRRecord extends RecordsAPI.NAPTRRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SMIMEARecord extends RecordsAPI.SMIMEARecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SRVRecord extends RecordsAPI.SRVRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SSHFPRecord extends RecordsAPI.SSHFPRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SVCBRecord extends RecordsAPI.SVCBRecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface TLSARecord extends RecordsAPI.TLSARecord {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface URIRecord extends RecordsAPI.URIRecord {
    /**
     * Identifier.
     */
    id: string;
  }
}

export type BatchPutParam =
  | BatchPutParam.ARecord
  | BatchPutParam.AAAARecord
  | BatchPutParam.CNAMERecord
  | BatchPutParam.MXRecord
  | BatchPutParam.NSRecord
  | BatchPutParam.OpenpgpkeyRecord
  | BatchPutParam.PTRRecord
  | BatchPutParam.TXTRecord
  | BatchPutParam.CAARecord
  | BatchPutParam.CERTRecord
  | BatchPutParam.DNSKEYRecord
  | BatchPutParam.DSRecord
  | BatchPutParam.HTTPSRecord
  | BatchPutParam.LOCRecord
  | BatchPutParam.NAPTRRecord
  | BatchPutParam.SMIMEARecord
  | BatchPutParam.SRVRecord
  | BatchPutParam.SSHFPRecord
  | BatchPutParam.SVCBRecord
  | BatchPutParam.TLSARecord
  | BatchPutParam.URIRecord;

export namespace BatchPutParam {
  export interface ARecord extends RecordsAPI.ARecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface AAAARecord extends RecordsAPI.AAAARecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CNAMERecord extends RecordsAPI.CNAMERecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface MXRecord extends RecordsAPI.MXRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface NSRecord extends RecordsAPI.NSRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface OpenpgpkeyRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
     * Value must be between 60 and 86400, with the minimum reduced to 30 for
     * Enterprise zones.
     */
    ttl: RecordsAPI.TTLParam;

    /**
     * Record type.
     */
    type: 'OPENPGPKEY';

    /**
     * Comments or notes about the DNS record. This field has no effect on DNS
     * responses.
     */
    comment?: string;

    /**
     * A single Base64-encoded OpenPGP Transferable Public Key (RFC 4880 Section 11.1)
     */
    content?: string;

    /**
     * Whether the record is receiving the performance and security benefits of
     * Cloudflare.
     */
    proxied?: boolean;

    /**
     * Settings for the DNS record.
     */
    settings?: OpenpgpkeyRecord.Settings;

    /**
     * Custom tags for the DNS record. This field has no effect on DNS responses.
     */
    tags?: Array<RecordsAPI.RecordTagsParam>;
  }

  export namespace OpenpgpkeyRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface PTRRecord extends RecordsAPI.PTRRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface TXTRecord extends RecordsAPI.TXTRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CAARecord extends RecordsAPI.CAARecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface CERTRecord extends RecordsAPI.CERTRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface DNSKEYRecord extends RecordsAPI.DNSKEYRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface DSRecord extends RecordsAPI.DSRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface HTTPSRecord extends RecordsAPI.HTTPSRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface LOCRecord extends RecordsAPI.LOCRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface NAPTRRecord extends RecordsAPI.NAPTRRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SMIMEARecord extends RecordsAPI.SMIMEARecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SRVRecord extends RecordsAPI.SRVRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SSHFPRecord extends RecordsAPI.SSHFPRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface SVCBRecord extends RecordsAPI.SVCBRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface TLSARecord extends RecordsAPI.TLSARecordParam {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface URIRecord extends RecordsAPI.URIRecordParam {
    /**
     * Identifier.
     */
    id: string;
  }
}

export interface CAARecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'CAA';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted CAA content. See 'data' to set CAA properties.
   */
  content?: string;

  /**
   * Components of a CAA record.
   */
  data?: CAARecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: CAARecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace CAARecord {
  /**
   * Components of a CAA record.
   */
  export interface Data {
    /**
     * Flags for the CAA record.
     */
    flags?: number;

    /**
     * Name of the property controlled by this record (e.g.: issue, issuewild, iodef).
     */
    tag?: string;

    /**
     * Value of the record. This field's semantics depend on the chosen tag.
     */
    value?: string;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface CAARecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'CAA';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a CAA record.
   */
  data?: CAARecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: CAARecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace CAARecordParam {
  /**
   * Components of a CAA record.
   */
  export interface Data {
    /**
     * Flags for the CAA record.
     */
    flags?: number;

    /**
     * Name of the property controlled by this record (e.g.: issue, issuewild, iodef).
     */
    tag?: string;

    /**
     * Value of the record. This field's semantics depend on the chosen tag.
     */
    value?: string;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface CERTRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'CERT';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted CERT content. See 'data' to set CERT properties.
   */
  content?: string;

  /**
   * Components of a CERT record.
   */
  data?: CERTRecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: CERTRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace CERTRecord {
  /**
   * Components of a CERT record.
   */
  export interface Data {
    /**
     * Algorithm.
     */
    algorithm?: number;

    /**
     * Certificate.
     */
    certificate?: string;

    /**
     * Key Tag.
     */
    key_tag?: number;

    /**
     * Type.
     */
    type?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface CERTRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'CERT';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a CERT record.
   */
  data?: CERTRecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: CERTRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace CERTRecordParam {
  /**
   * Components of a CERT record.
   */
  export interface Data {
    /**
     * Algorithm.
     */
    algorithm?: number;

    /**
     * Certificate.
     */
    certificate?: string;

    /**
     * Key Tag.
     */
    key_tag?: number;

    /**
     * Type.
     */
    type?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface CNAMERecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'CNAME';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * A valid hostname. Must not match the record's name.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: CNAMERecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace CNAMERecord {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * If enabled, causes the CNAME record to be resolved externally and the resulting
     * address records (e.g., A and AAAA) to be returned instead of the CNAME record
     * itself. This setting is unavailable for proxied records, since they are always
     * flattened.
     */
    flatten_cname?: boolean;

    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface CNAMERecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'CNAME';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * A valid hostname. Must not match the record's name.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: CNAMERecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace CNAMERecordParam {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * If enabled, causes the CNAME record to be resolved externally and the resulting
     * address records (e.g., A and AAAA) to be returned instead of the CNAME record
     * itself. This setting is unavailable for proxied records, since they are always
     * flattened.
     */
    flatten_cname?: boolean;

    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface DNSKEYRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'DNSKEY';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted DNSKEY content. See 'data' to set DNSKEY properties.
   */
  content?: string;

  /**
   * Components of a DNSKEY record.
   */
  data?: DNSKEYRecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: DNSKEYRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace DNSKEYRecord {
  /**
   * Components of a DNSKEY record.
   */
  export interface Data {
    /**
     * Algorithm.
     */
    algorithm?: number;

    /**
     * Flags.
     */
    flags?: number;

    /**
     * Protocol.
     */
    protocol?: number;

    /**
     * Public Key.
     */
    public_key?: string;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface DNSKEYRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'DNSKEY';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a DNSKEY record.
   */
  data?: DNSKEYRecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: DNSKEYRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace DNSKEYRecordParam {
  /**
   * Components of a DNSKEY record.
   */
  export interface Data {
    /**
     * Algorithm.
     */
    algorithm?: number;

    /**
     * Flags.
     */
    flags?: number;

    /**
     * Protocol.
     */
    protocol?: number;

    /**
     * Public Key.
     */
    public_key?: string;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface DSRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'DS';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted DS content. See 'data' to set DS properties.
   */
  content?: string;

  /**
   * Components of a DS record.
   */
  data?: DSRecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: DSRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace DSRecord {
  /**
   * Components of a DS record.
   */
  export interface Data {
    /**
     * Algorithm.
     */
    algorithm?: number;

    /**
     * Digest.
     */
    digest?: string;

    /**
     * Digest Type.
     */
    digest_type?: number;

    /**
     * Key Tag.
     */
    key_tag?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface DSRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'DS';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a DS record.
   */
  data?: DSRecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: DSRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace DSRecordParam {
  /**
   * Components of a DS record.
   */
  export interface Data {
    /**
     * Algorithm.
     */
    algorithm?: number;

    /**
     * Digest.
     */
    digest?: string;

    /**
     * Digest Type.
     */
    digest_type?: number;

    /**
     * Key Tag.
     */
    key_tag?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface HTTPSRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'HTTPS';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted HTTPS content. See 'data' to set HTTPS properties.
   */
  content?: string;

  /**
   * Components of a HTTPS record.
   */
  data?: HTTPSRecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: HTTPSRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace HTTPSRecord {
  /**
   * Components of a HTTPS record.
   */
  export interface Data {
    /**
     * priority.
     */
    priority?: number;

    /**
     * target.
     */
    target?: string;

    /**
     * value.
     */
    value?: string;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface HTTPSRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'HTTPS';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a HTTPS record.
   */
  data?: HTTPSRecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: HTTPSRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace HTTPSRecordParam {
  /**
   * Components of a HTTPS record.
   */
  export interface Data {
    /**
     * priority.
     */
    priority?: number;

    /**
     * target.
     */
    target?: string;

    /**
     * value.
     */
    value?: string;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface LOCRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'LOC';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted LOC content. See 'data' to set LOC properties.
   */
  content?: string;

  /**
   * Components of a LOC record.
   */
  data?: LOCRecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: LOCRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace LOCRecord {
  /**
   * Components of a LOC record.
   */
  export interface Data {
    /**
     * Altitude of location in meters.
     */
    altitude?: number;

    /**
     * Degrees of latitude.
     */
    lat_degrees?: number;

    /**
     * Latitude direction.
     */
    lat_direction?: 'N' | 'S';

    /**
     * Minutes of latitude.
     */
    lat_minutes?: number;

    /**
     * Seconds of latitude.
     */
    lat_seconds?: number;

    /**
     * Degrees of longitude.
     */
    long_degrees?: number;

    /**
     * Longitude direction.
     */
    long_direction?: 'E' | 'W';

    /**
     * Minutes of longitude.
     */
    long_minutes?: number;

    /**
     * Seconds of longitude.
     */
    long_seconds?: number;

    /**
     * Horizontal precision of location.
     */
    precision_horz?: number;

    /**
     * Vertical precision of location.
     */
    precision_vert?: number;

    /**
     * Size of location in meters.
     */
    size?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface LOCRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'LOC';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a LOC record.
   */
  data?: LOCRecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: LOCRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace LOCRecordParam {
  /**
   * Components of a LOC record.
   */
  export interface Data {
    /**
     * Altitude of location in meters.
     */
    altitude?: number;

    /**
     * Degrees of latitude.
     */
    lat_degrees?: number;

    /**
     * Latitude direction.
     */
    lat_direction?: 'N' | 'S';

    /**
     * Minutes of latitude.
     */
    lat_minutes?: number;

    /**
     * Seconds of latitude.
     */
    lat_seconds?: number;

    /**
     * Degrees of longitude.
     */
    long_degrees?: number;

    /**
     * Longitude direction.
     */
    long_direction?: 'E' | 'W';

    /**
     * Minutes of longitude.
     */
    long_minutes?: number;

    /**
     * Seconds of longitude.
     */
    long_seconds?: number;

    /**
     * Horizontal precision of location.
     */
    precision_horz?: number;

    /**
     * Vertical precision of location.
     */
    precision_vert?: number;

    /**
     * Size of location in meters.
     */
    size?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface MXRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'MX';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * A valid mail server hostname.
   */
  content?: string;

  /**
   * Required for MX, SRV and URI records; unused by other record types. Records with
   * lower priorities are preferred.
   */
  priority?: number;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: MXRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace MXRecord {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface MXRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'MX';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * A valid mail server hostname.
   */
  content?: string;

  /**
   * Required for MX, SRV and URI records; unused by other record types. Records with
   * lower priorities are preferred.
   */
  priority?: number;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: MXRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace MXRecordParam {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface NAPTRRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'NAPTR';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted NAPTR content. See 'data' to set NAPTR properties.
   */
  content?: string;

  /**
   * Components of a NAPTR record.
   */
  data?: NAPTRRecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: NAPTRRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace NAPTRRecord {
  /**
   * Components of a NAPTR record.
   */
  export interface Data {
    /**
     * Flags.
     */
    flags?: string;

    /**
     * Order.
     */
    order?: number;

    /**
     * Preference.
     */
    preference?: number;

    /**
     * Regex.
     */
    regex?: string;

    /**
     * Replacement.
     */
    replacement?: string;

    /**
     * Service.
     */
    service?: string;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface NAPTRRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'NAPTR';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a NAPTR record.
   */
  data?: NAPTRRecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: NAPTRRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace NAPTRRecordParam {
  /**
   * Components of a NAPTR record.
   */
  export interface Data {
    /**
     * Flags.
     */
    flags?: string;

    /**
     * Order.
     */
    order?: number;

    /**
     * Preference.
     */
    preference?: number;

    /**
     * Regex.
     */
    regex?: string;

    /**
     * Replacement.
     */
    replacement?: string;

    /**
     * Service.
     */
    service?: string;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface NSRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'NS';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * A valid name server host name.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: NSRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace NSRecord {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface NSRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'NS';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * A valid name server host name.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: NSRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace NSRecordParam {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface PTRRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'PTR';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Domain name pointing to the address.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: PTRRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace PTRRecord {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface PTRRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'PTR';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Domain name pointing to the address.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: PTRRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace PTRRecordParam {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export type Record =
  | ARecord
  | AAAARecord
  | CNAMERecord
  | MXRecord
  | NSRecord
  | Record.Openpgpkey
  | PTRRecord
  | TXTRecord
  | CAARecord
  | CERTRecord
  | DNSKEYRecord
  | DSRecord
  | HTTPSRecord
  | LOCRecord
  | NAPTRRecord
  | SMIMEARecord
  | SRVRecord
  | SSHFPRecord
  | SVCBRecord
  | TLSARecord
  | URIRecord;

export namespace Record {
  export interface Openpgpkey {
    /**
     * DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
     * Value must be between 60 and 86400, with the minimum reduced to 30 for
     * Enterprise zones.
     */
    ttl: RecordsAPI.TTL;

    /**
     * Record type.
     */
    type: 'OPENPGPKEY';

    /**
     * Comments or notes about the DNS record. This field has no effect on DNS
     * responses.
     */
    comment?: string;

    /**
     * A single Base64-encoded OpenPGP Transferable Public Key (RFC 4880 Section 11.1)
     */
    content?: string;

    /**
     * Whether the record is receiving the performance and security benefits of
     * Cloudflare.
     */
    proxied?: boolean;

    /**
     * Settings for the DNS record.
     */
    settings?: Openpgpkey.Settings;

    /**
     * Custom tags for the DNS record. This field has no effect on DNS responses.
     */
    tags?: Array<RecordsAPI.RecordTags>;
  }

  export namespace Openpgpkey {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }
}

export type RecordResponse =
  | RecordResponse.ARecord
  | RecordResponse.AAAARecord
  | RecordResponse.CNAMERecord
  | RecordResponse.MXRecord
  | RecordResponse.NSRecord
  | RecordResponse.OpenpgpkeyRecord
  | RecordResponse.PTRRecord
  | RecordResponse.TXTRecord
  | RecordResponse.CAARecord
  | RecordResponse.CERTRecord
  | RecordResponse.DNSKEYRecord
  | RecordResponse.DSRecord
  | RecordResponse.HTTPSRecord
  | RecordResponse.LOCRecord
  | RecordResponse.NAPTRRecord
  | RecordResponse.SMIMEARecord
  | RecordResponse.SRVRecord
  | RecordResponse.SSHFPRecord
  | RecordResponse.SVCBRecord
  | RecordResponse.TLSARecord
  | RecordResponse.URIRecord;

export namespace RecordResponse {
  export interface ARecord extends RecordsAPI.ARecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface AAAARecord extends RecordsAPI.AAAARecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface CNAMERecord extends RecordsAPI.CNAMERecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface MXRecord extends RecordsAPI.MXRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface NSRecord extends RecordsAPI.NSRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface OpenpgpkeyRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * Comments or notes about the DNS record. This field has no effect on DNS
     * responses.
     */
    comment: string;

    /**
     * A single Base64-encoded OpenPGP Transferable Public Key (RFC 4880 Section 11.1)
     */
    content: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * Whether the record is receiving the performance and security benefits of
     * Cloudflare.
     */
    proxied: boolean;

    /**
     * Settings for the DNS record.
     */
    settings: OpenpgpkeyRecord.Settings;

    /**
     * Custom tags for the DNS record. This field has no effect on DNS responses.
     */
    tags: Array<RecordsAPI.RecordTags>;

    /**
     * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
     * Value must be between 60 and 86400, with the minimum reduced to 30 for
     * Enterprise zones.
     */
    ttl: RecordsAPI.TTL;

    /**
     * Record type.
     */
    type: 'OPENPGPKEY';

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export namespace OpenpgpkeyRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface PTRRecord extends RecordsAPI.PTRRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface TXTRecord extends RecordsAPI.TXTRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface CAARecord extends RecordsAPI.CAARecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface CERTRecord extends RecordsAPI.CERTRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface DNSKEYRecord extends RecordsAPI.DNSKEYRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface DSRecord extends RecordsAPI.DSRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface HTTPSRecord extends RecordsAPI.HTTPSRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface LOCRecord extends RecordsAPI.LOCRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface NAPTRRecord extends RecordsAPI.NAPTRRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface SMIMEARecord extends RecordsAPI.SMIMEARecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface SRVRecord extends RecordsAPI.SRVRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface SSHFPRecord extends RecordsAPI.SSHFPRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface SVCBRecord extends RecordsAPI.SVCBRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface TLSARecord extends RecordsAPI.TLSARecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }

  export interface URIRecord extends RecordsAPI.URIRecord {
    /**
     * Identifier.
     */
    id: string;

    /**
     * When the record was created.
     */
    created_on: string;

    /**
     * Extra Cloudflare-specific information about the record.
     */
    meta: unknown;

    /**
     * When the record was last modified.
     */
    modified_on: string;

    /**
     * Whether the record can be proxied by Cloudflare or not.
     */
    proxiable: boolean;

    /**
     * When the record comment was last modified. Omitted if there is no comment.
     */
    comment_modified_on?: string;

    /**
     * When the record tags were last modified. Omitted if there are no tags.
     */
    tags_modified_on?: string;
  }
}

/**
 * Individual tag of the form name:value (the name must consist of only letters,
 * numbers, underscores and hyphens)
 */
export type RecordTags = string;

/**
 * Individual tag of the form name:value (the name must consist of only letters,
 * numbers, underscores and hyphens)
 */
export type RecordTagsParam = string;

export interface SMIMEARecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'SMIMEA';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted SMIMEA content. See 'data' to set SMIMEA properties.
   */
  content?: string;

  /**
   * Components of a SMIMEA record.
   */
  data?: SMIMEARecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: SMIMEARecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace SMIMEARecord {
  /**
   * Components of a SMIMEA record.
   */
  export interface Data {
    /**
     * Certificate.
     */
    certificate?: string;

    /**
     * Matching Type.
     */
    matching_type?: number;

    /**
     * Selector.
     */
    selector?: number;

    /**
     * Usage.
     */
    usage?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface SMIMEARecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'SMIMEA';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a SMIMEA record.
   */
  data?: SMIMEARecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: SMIMEARecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace SMIMEARecordParam {
  /**
   * Components of a SMIMEA record.
   */
  export interface Data {
    /**
     * Certificate.
     */
    certificate?: string;

    /**
     * Matching Type.
     */
    matching_type?: number;

    /**
     * Selector.
     */
    selector?: number;

    /**
     * Usage.
     */
    usage?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface SRVRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'SRV';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Priority, weight, port, and SRV target. See 'data' for setting the individual
   * component values.
   */
  content?: string;

  /**
   * Components of a SRV record.
   */
  data?: SRVRecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: SRVRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace SRVRecord {
  /**
   * Components of a SRV record.
   */
  export interface Data {
    /**
     * The port of the service.
     */
    port?: number;

    /**
     * Required for MX, SRV and URI records; unused by other record types. Records with
     * lower priorities are preferred.
     */
    priority?: number;

    /**
     * A valid hostname.
     */
    target?: string;

    /**
     * The record weight.
     */
    weight?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface SRVRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'SRV';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a SRV record.
   */
  data?: SRVRecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: SRVRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace SRVRecordParam {
  /**
   * Components of a SRV record.
   */
  export interface Data {
    /**
     * The port of the service.
     */
    port?: number;

    /**
     * Required for MX, SRV and URI records; unused by other record types. Records with
     * lower priorities are preferred.
     */
    priority?: number;

    /**
     * A valid hostname.
     */
    target?: string;

    /**
     * The record weight.
     */
    weight?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface SSHFPRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'SSHFP';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted SSHFP content. See 'data' to set SSHFP properties.
   */
  content?: string;

  /**
   * Components of a SSHFP record.
   */
  data?: SSHFPRecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: SSHFPRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace SSHFPRecord {
  /**
   * Components of a SSHFP record.
   */
  export interface Data {
    /**
     * algorithm.
     */
    algorithm?: number;

    /**
     * fingerprint.
     */
    fingerprint?: string;

    /**
     * type.
     */
    type?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface SSHFPRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'SSHFP';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a SSHFP record.
   */
  data?: SSHFPRecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: SSHFPRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace SSHFPRecordParam {
  /**
   * Components of a SSHFP record.
   */
  export interface Data {
    /**
     * algorithm.
     */
    algorithm?: number;

    /**
     * fingerprint.
     */
    fingerprint?: string;

    /**
     * type.
     */
    type?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface SVCBRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'SVCB';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted SVCB content. See 'data' to set SVCB properties.
   */
  content?: string;

  /**
   * Components of a SVCB record.
   */
  data?: SVCBRecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: SVCBRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace SVCBRecord {
  /**
   * Components of a SVCB record.
   */
  export interface Data {
    /**
     * priority.
     */
    priority?: number;

    /**
     * target.
     */
    target?: string;

    /**
     * value.
     */
    value?: string;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface SVCBRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'SVCB';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a SVCB record.
   */
  data?: SVCBRecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: SVCBRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace SVCBRecordParam {
  /**
   * Components of a SVCB record.
   */
  export interface Data {
    /**
     * priority.
     */
    priority?: number;

    /**
     * target.
     */
    target?: string;

    /**
     * value.
     */
    value?: string;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface TLSARecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'TLSA';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted TLSA content. See 'data' to set TLSA properties.
   */
  content?: string;

  /**
   * Components of a TLSA record.
   */
  data?: TLSARecord.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: TLSARecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace TLSARecord {
  /**
   * Components of a TLSA record.
   */
  export interface Data {
    /**
     * certificate.
     */
    certificate?: string;

    /**
     * Matching Type.
     */
    matching_type?: number;

    /**
     * Selector.
     */
    selector?: number;

    /**
     * Usage.
     */
    usage?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface TLSARecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'TLSA';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a TLSA record.
   */
  data?: TLSARecordParam.Data;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: TLSARecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace TLSARecordParam {
  /**
   * Components of a TLSA record.
   */
  export interface Data {
    /**
     * certificate.
     */
    certificate?: string;

    /**
     * Matching Type.
     */
    matching_type?: number;

    /**
     * Selector.
     */
    selector?: number;

    /**
     * Usage.
     */
    usage?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

/**
 * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
 * Value must be between 60 and 86400, with the minimum reduced to 30 for
 * Enterprise zones.
 */
export type TTL = number | 1;

/**
 * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
 * Value must be between 60 and 86400, with the minimum reduced to 30 for
 * Enterprise zones.
 */
export type TTLParam = number | 1;

export interface TXTRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'TXT';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Text content for the record. The content must consist of quoted "character
   * strings" (RFC 1035), each with a length of up to 255 bytes. Strings exceeding
   * this allowed maximum length are automatically split.
   *
   * Learn more at
   * <https://www.cloudflare.com/learning/dns/dns-records/dns-txt-record/>.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: TXTRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace TXTRecord {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface TXTRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'TXT';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Text content for the record. The content must consist of quoted "character
   * strings" (RFC 1035), each with a length of up to 255 bytes. Strings exceeding
   * this allowed maximum length are automatically split.
   *
   * Learn more at
   * <https://www.cloudflare.com/learning/dns/dns-records/dns-txt-record/>.
   */
  content?: string;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: TXTRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace TXTRecordParam {
  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface URIRecord {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTL;

  /**
   * Record type.
   */
  type: 'URI';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Formatted URI content. See 'data' to set URI properties.
   */
  content?: string;

  /**
   * Components of a URI record.
   */
  data?: URIRecord.Data;

  /**
   * Required for MX, SRV and URI records; unused by other record types. Records with
   * lower priorities are preferred.
   */
  priority?: number;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: URIRecord.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTags>;
}

export namespace URIRecord {
  /**
   * Components of a URI record.
   */
  export interface Data {
    /**
     * The record content.
     */
    target?: string;

    /**
     * The record weight.
     */
    weight?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface URIRecordParam {
  /**
   * DNS record name (or @ for the zone apex) in Punycode.
   */
  name: string;

  /**
   * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
   * Value must be between 60 and 86400, with the minimum reduced to 30 for
   * Enterprise zones.
   */
  ttl: TTLParam;

  /**
   * Record type.
   */
  type: 'URI';

  /**
   * Comments or notes about the DNS record. This field has no effect on DNS
   * responses.
   */
  comment?: string;

  /**
   * Components of a URI record.
   */
  data?: URIRecordParam.Data;

  /**
   * Required for MX, SRV and URI records; unused by other record types. Records with
   * lower priorities are preferred.
   */
  priority?: number;

  /**
   * Whether the record is receiving the performance and security benefits of
   * Cloudflare.
   */
  proxied?: boolean;

  /**
   * Settings for the DNS record.
   */
  settings?: URIRecordParam.Settings;

  /**
   * Custom tags for the DNS record. This field has no effect on DNS responses.
   */
  tags?: Array<RecordTagsParam>;
}

export namespace URIRecordParam {
  /**
   * Components of a URI record.
   */
  export interface Data {
    /**
     * The record content.
     */
    target?: string;

    /**
     * The record weight.
     */
    weight?: number;
  }

  /**
   * Settings for the DNS record.
   */
  export interface Settings {
    /**
     * When enabled, only A records will be generated, and AAAA records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv4_only?: boolean;

    /**
     * When enabled, only AAAA records will be generated, and A records will not be
     * created. This setting is intended for exceptional cases. Note that this option
     * only applies to proxied records and it has no effect on whether Cloudflare
     * communicates with the origin using IPv4 or IPv6.
     */
    ipv6_only?: boolean;
  }
}

export interface RecordDeleteResponse {
  /**
   * Identifier.
   */
  id?: string;
}

export interface RecordBatchResponse {
  deletes?: Array<RecordResponse>;

  patches?: Array<RecordResponse>;

  posts?: Array<RecordResponse>;

  puts?: Array<RecordResponse>;
}

/**
 * Exported BIND zone file.
 */
export type RecordExportResponse = string;

export interface RecordImportResponse {
  /**
   * Number of DNS records added.
   */
  recs_added?: number;

  /**
   * Total number of DNS records parsed.
   */
  total_records_parsed?: number;
}

export interface RecordScanResponse {
  /**
   * Number of DNS records added.
   */
  recs_added?: number;

  /**
   * Total number of DNS records parsed.
   */
  total_records_parsed?: number;
}

export type RecordCreateParams =
  | RecordCreateParams.ARecord
  | RecordCreateParams.AAAARecord
  | RecordCreateParams.CNAMERecord
  | RecordCreateParams.MXRecord
  | RecordCreateParams.NSRecord
  | RecordCreateParams.DNSRecordsOpenpgpkeyRecord
  | RecordCreateParams.PTRRecord
  | RecordCreateParams.TXTRecord
  | RecordCreateParams.CAARecord
  | RecordCreateParams.CERTRecord
  | RecordCreateParams.DNSKEYRecord
  | RecordCreateParams.DSRecord
  | RecordCreateParams.HTTPSRecord
  | RecordCreateParams.LOCRecord
  | RecordCreateParams.NAPTRRecord
  | RecordCreateParams.SMIMEARecord
  | RecordCreateParams.SRVRecord
  | RecordCreateParams.SSHFPRecord
  | RecordCreateParams.SVCBRecord
  | RecordCreateParams.TLSARecord
  | RecordCreateParams.URIRecord;

export declare namespace RecordCreateParams {
  export interface ARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'A';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid IPv4 address.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: ARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace ARecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface AAAARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'AAAA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid IPv6 address.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: AAAARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace AAAARecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface CNAMERecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'CNAME';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid hostname. Must not match the record's name.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: CNAMERecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace CNAMERecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * If enabled, causes the CNAME record to be resolved externally and the resulting
       * address records (e.g., A and AAAA) to be returned instead of the CNAME record
       * itself. This setting is unavailable for proxied records, since they are always
       * flattened.
       */
      flatten_cname?: boolean;

      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface MXRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'MX';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid mail server hostname.
     */
    content?: string;

    /**
     * Body param: Required for MX, SRV and URI records; unused by other record types.
     * Records with lower priorities are preferred.
     */
    priority?: number;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: MXRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace MXRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface NSRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'NS';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid name server host name.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: NSRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace NSRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface DNSRecordsOpenpgpkeyRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'OPENPGPKEY';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A single Base64-encoded OpenPGP Transferable Public Key (RFC 4880
     * Section 11.1)
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: DNSRecordsOpenpgpkeyRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace DNSRecordsOpenpgpkeyRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface PTRRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'PTR';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Domain name pointing to the address.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: PTRRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace PTRRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface TXTRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'TXT';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Text content for the record. The content must consist of quoted
     * "character strings" (RFC 1035), each with a length of up to 255 bytes. Strings
     * exceeding this allowed maximum length are automatically split.
     *
     * Learn more at
     * <https://www.cloudflare.com/learning/dns/dns-records/dns-txt-record/>.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: TXTRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace TXTRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface CAARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'CAA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a CAA record.
     */
    data?: CAARecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: CAARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace CAARecord {
    /**
     * Components of a CAA record.
     */
    export interface Data {
      /**
       * Flags for the CAA record.
       */
      flags?: number;

      /**
       * Name of the property controlled by this record (e.g.: issue, issuewild, iodef).
       */
      tag?: string;

      /**
       * Value of the record. This field's semantics depend on the chosen tag.
       */
      value?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface CERTRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'CERT';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a CERT record.
     */
    data?: CERTRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: CERTRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace CERTRecord {
    /**
     * Components of a CERT record.
     */
    export interface Data {
      /**
       * Algorithm.
       */
      algorithm?: number;

      /**
       * Certificate.
       */
      certificate?: string;

      /**
       * Key Tag.
       */
      key_tag?: number;

      /**
       * Type.
       */
      type?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface DNSKEYRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'DNSKEY';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a DNSKEY record.
     */
    data?: DNSKEYRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: DNSKEYRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace DNSKEYRecord {
    /**
     * Components of a DNSKEY record.
     */
    export interface Data {
      /**
       * Algorithm.
       */
      algorithm?: number;

      /**
       * Flags.
       */
      flags?: number;

      /**
       * Protocol.
       */
      protocol?: number;

      /**
       * Public Key.
       */
      public_key?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface DSRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'DS';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a DS record.
     */
    data?: DSRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: DSRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace DSRecord {
    /**
     * Components of a DS record.
     */
    export interface Data {
      /**
       * Algorithm.
       */
      algorithm?: number;

      /**
       * Digest.
       */
      digest?: string;

      /**
       * Digest Type.
       */
      digest_type?: number;

      /**
       * Key Tag.
       */
      key_tag?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface HTTPSRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'HTTPS';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a HTTPS record.
     */
    data?: HTTPSRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: HTTPSRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace HTTPSRecord {
    /**
     * Components of a HTTPS record.
     */
    export interface Data {
      /**
       * priority.
       */
      priority?: number;

      /**
       * target.
       */
      target?: string;

      /**
       * value.
       */
      value?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface LOCRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'LOC';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a LOC record.
     */
    data?: LOCRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: LOCRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace LOCRecord {
    /**
     * Components of a LOC record.
     */
    export interface Data {
      /**
       * Altitude of location in meters.
       */
      altitude?: number;

      /**
       * Degrees of latitude.
       */
      lat_degrees?: number;

      /**
       * Latitude direction.
       */
      lat_direction?: 'N' | 'S';

      /**
       * Minutes of latitude.
       */
      lat_minutes?: number;

      /**
       * Seconds of latitude.
       */
      lat_seconds?: number;

      /**
       * Degrees of longitude.
       */
      long_degrees?: number;

      /**
       * Longitude direction.
       */
      long_direction?: 'E' | 'W';

      /**
       * Minutes of longitude.
       */
      long_minutes?: number;

      /**
       * Seconds of longitude.
       */
      long_seconds?: number;

      /**
       * Horizontal precision of location.
       */
      precision_horz?: number;

      /**
       * Vertical precision of location.
       */
      precision_vert?: number;

      /**
       * Size of location in meters.
       */
      size?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface NAPTRRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'NAPTR';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a NAPTR record.
     */
    data?: NAPTRRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: NAPTRRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace NAPTRRecord {
    /**
     * Components of a NAPTR record.
     */
    export interface Data {
      /**
       * Flags.
       */
      flags?: string;

      /**
       * Order.
       */
      order?: number;

      /**
       * Preference.
       */
      preference?: number;

      /**
       * Regex.
       */
      regex?: string;

      /**
       * Replacement.
       */
      replacement?: string;

      /**
       * Service.
       */
      service?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SMIMEARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SMIMEA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SMIMEA record.
     */
    data?: SMIMEARecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SMIMEARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SMIMEARecord {
    /**
     * Components of a SMIMEA record.
     */
    export interface Data {
      /**
       * Certificate.
       */
      certificate?: string;

      /**
       * Matching Type.
       */
      matching_type?: number;

      /**
       * Selector.
       */
      selector?: number;

      /**
       * Usage.
       */
      usage?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SRVRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SRV';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SRV record.
     */
    data?: SRVRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SRVRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SRVRecord {
    /**
     * Components of a SRV record.
     */
    export interface Data {
      /**
       * The port of the service.
       */
      port?: number;

      /**
       * Required for MX, SRV and URI records; unused by other record types. Records with
       * lower priorities are preferred.
       */
      priority?: number;

      /**
       * A valid hostname.
       */
      target?: string;

      /**
       * The record weight.
       */
      weight?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SSHFPRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SSHFP';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SSHFP record.
     */
    data?: SSHFPRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SSHFPRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SSHFPRecord {
    /**
     * Components of a SSHFP record.
     */
    export interface Data {
      /**
       * algorithm.
       */
      algorithm?: number;

      /**
       * fingerprint.
       */
      fingerprint?: string;

      /**
       * type.
       */
      type?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SVCBRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SVCB';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SVCB record.
     */
    data?: SVCBRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SVCBRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SVCBRecord {
    /**
     * Components of a SVCB record.
     */
    export interface Data {
      /**
       * priority.
       */
      priority?: number;

      /**
       * target.
       */
      target?: string;

      /**
       * value.
       */
      value?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface TLSARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'TLSA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a TLSA record.
     */
    data?: TLSARecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: TLSARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace TLSARecord {
    /**
     * Components of a TLSA record.
     */
    export interface Data {
      /**
       * certificate.
       */
      certificate?: string;

      /**
       * Matching Type.
       */
      matching_type?: number;

      /**
       * Selector.
       */
      selector?: number;

      /**
       * Usage.
       */
      usage?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface URIRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'URI';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a URI record.
     */
    data?: URIRecord.Data;

    /**
     * Body param: Required for MX, SRV and URI records; unused by other record types.
     * Records with lower priorities are preferred.
     */
    priority?: number;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: URIRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace URIRecord {
    /**
     * Components of a URI record.
     */
    export interface Data {
      /**
       * The record content.
       */
      target?: string;

      /**
       * The record weight.
       */
      weight?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }
}

export type RecordUpdateParams =
  | RecordUpdateParams.ARecord
  | RecordUpdateParams.AAAARecord
  | RecordUpdateParams.CNAMERecord
  | RecordUpdateParams.MXRecord
  | RecordUpdateParams.NSRecord
  | RecordUpdateParams.DNSRecordsOpenpgpkeyRecord
  | RecordUpdateParams.PTRRecord
  | RecordUpdateParams.TXTRecord
  | RecordUpdateParams.CAARecord
  | RecordUpdateParams.CERTRecord
  | RecordUpdateParams.DNSKEYRecord
  | RecordUpdateParams.DSRecord
  | RecordUpdateParams.HTTPSRecord
  | RecordUpdateParams.LOCRecord
  | RecordUpdateParams.NAPTRRecord
  | RecordUpdateParams.SMIMEARecord
  | RecordUpdateParams.SRVRecord
  | RecordUpdateParams.SSHFPRecord
  | RecordUpdateParams.SVCBRecord
  | RecordUpdateParams.TLSARecord
  | RecordUpdateParams.URIRecord;

export declare namespace RecordUpdateParams {
  export interface ARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'A';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid IPv4 address.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: ARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace ARecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface AAAARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'AAAA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid IPv6 address.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: AAAARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace AAAARecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface CNAMERecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'CNAME';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid hostname. Must not match the record's name.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: CNAMERecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace CNAMERecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * If enabled, causes the CNAME record to be resolved externally and the resulting
       * address records (e.g., A and AAAA) to be returned instead of the CNAME record
       * itself. This setting is unavailable for proxied records, since they are always
       * flattened.
       */
      flatten_cname?: boolean;

      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface MXRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'MX';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid mail server hostname.
     */
    content?: string;

    /**
     * Body param: Required for MX, SRV and URI records; unused by other record types.
     * Records with lower priorities are preferred.
     */
    priority?: number;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: MXRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace MXRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface NSRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'NS';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid name server host name.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: NSRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace NSRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface DNSRecordsOpenpgpkeyRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'OPENPGPKEY';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A single Base64-encoded OpenPGP Transferable Public Key (RFC 4880
     * Section 11.1)
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: DNSRecordsOpenpgpkeyRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace DNSRecordsOpenpgpkeyRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface PTRRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'PTR';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Domain name pointing to the address.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: PTRRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace PTRRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface TXTRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'TXT';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Text content for the record. The content must consist of quoted
     * "character strings" (RFC 1035), each with a length of up to 255 bytes. Strings
     * exceeding this allowed maximum length are automatically split.
     *
     * Learn more at
     * <https://www.cloudflare.com/learning/dns/dns-records/dns-txt-record/>.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: TXTRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace TXTRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface CAARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'CAA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a CAA record.
     */
    data?: CAARecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: CAARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace CAARecord {
    /**
     * Components of a CAA record.
     */
    export interface Data {
      /**
       * Flags for the CAA record.
       */
      flags?: number;

      /**
       * Name of the property controlled by this record (e.g.: issue, issuewild, iodef).
       */
      tag?: string;

      /**
       * Value of the record. This field's semantics depend on the chosen tag.
       */
      value?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface CERTRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'CERT';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a CERT record.
     */
    data?: CERTRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: CERTRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace CERTRecord {
    /**
     * Components of a CERT record.
     */
    export interface Data {
      /**
       * Algorithm.
       */
      algorithm?: number;

      /**
       * Certificate.
       */
      certificate?: string;

      /**
       * Key Tag.
       */
      key_tag?: number;

      /**
       * Type.
       */
      type?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface DNSKEYRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'DNSKEY';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a DNSKEY record.
     */
    data?: DNSKEYRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: DNSKEYRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace DNSKEYRecord {
    /**
     * Components of a DNSKEY record.
     */
    export interface Data {
      /**
       * Algorithm.
       */
      algorithm?: number;

      /**
       * Flags.
       */
      flags?: number;

      /**
       * Protocol.
       */
      protocol?: number;

      /**
       * Public Key.
       */
      public_key?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface DSRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'DS';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a DS record.
     */
    data?: DSRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: DSRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace DSRecord {
    /**
     * Components of a DS record.
     */
    export interface Data {
      /**
       * Algorithm.
       */
      algorithm?: number;

      /**
       * Digest.
       */
      digest?: string;

      /**
       * Digest Type.
       */
      digest_type?: number;

      /**
       * Key Tag.
       */
      key_tag?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface HTTPSRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'HTTPS';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a HTTPS record.
     */
    data?: HTTPSRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: HTTPSRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace HTTPSRecord {
    /**
     * Components of a HTTPS record.
     */
    export interface Data {
      /**
       * priority.
       */
      priority?: number;

      /**
       * target.
       */
      target?: string;

      /**
       * value.
       */
      value?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface LOCRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'LOC';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a LOC record.
     */
    data?: LOCRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: LOCRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace LOCRecord {
    /**
     * Components of a LOC record.
     */
    export interface Data {
      /**
       * Altitude of location in meters.
       */
      altitude?: number;

      /**
       * Degrees of latitude.
       */
      lat_degrees?: number;

      /**
       * Latitude direction.
       */
      lat_direction?: 'N' | 'S';

      /**
       * Minutes of latitude.
       */
      lat_minutes?: number;

      /**
       * Seconds of latitude.
       */
      lat_seconds?: number;

      /**
       * Degrees of longitude.
       */
      long_degrees?: number;

      /**
       * Longitude direction.
       */
      long_direction?: 'E' | 'W';

      /**
       * Minutes of longitude.
       */
      long_minutes?: number;

      /**
       * Seconds of longitude.
       */
      long_seconds?: number;

      /**
       * Horizontal precision of location.
       */
      precision_horz?: number;

      /**
       * Vertical precision of location.
       */
      precision_vert?: number;

      /**
       * Size of location in meters.
       */
      size?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface NAPTRRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'NAPTR';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a NAPTR record.
     */
    data?: NAPTRRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: NAPTRRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace NAPTRRecord {
    /**
     * Components of a NAPTR record.
     */
    export interface Data {
      /**
       * Flags.
       */
      flags?: string;

      /**
       * Order.
       */
      order?: number;

      /**
       * Preference.
       */
      preference?: number;

      /**
       * Regex.
       */
      regex?: string;

      /**
       * Replacement.
       */
      replacement?: string;

      /**
       * Service.
       */
      service?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SMIMEARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SMIMEA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SMIMEA record.
     */
    data?: SMIMEARecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SMIMEARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SMIMEARecord {
    /**
     * Components of a SMIMEA record.
     */
    export interface Data {
      /**
       * Certificate.
       */
      certificate?: string;

      /**
       * Matching Type.
       */
      matching_type?: number;

      /**
       * Selector.
       */
      selector?: number;

      /**
       * Usage.
       */
      usage?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SRVRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SRV';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SRV record.
     */
    data?: SRVRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SRVRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SRVRecord {
    /**
     * Components of a SRV record.
     */
    export interface Data {
      /**
       * The port of the service.
       */
      port?: number;

      /**
       * Required for MX, SRV and URI records; unused by other record types. Records with
       * lower priorities are preferred.
       */
      priority?: number;

      /**
       * A valid hostname.
       */
      target?: string;

      /**
       * The record weight.
       */
      weight?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SSHFPRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SSHFP';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SSHFP record.
     */
    data?: SSHFPRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SSHFPRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SSHFPRecord {
    /**
     * Components of a SSHFP record.
     */
    export interface Data {
      /**
       * algorithm.
       */
      algorithm?: number;

      /**
       * fingerprint.
       */
      fingerprint?: string;

      /**
       * type.
       */
      type?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SVCBRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SVCB';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SVCB record.
     */
    data?: SVCBRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SVCBRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SVCBRecord {
    /**
     * Components of a SVCB record.
     */
    export interface Data {
      /**
       * priority.
       */
      priority?: number;

      /**
       * target.
       */
      target?: string;

      /**
       * value.
       */
      value?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface TLSARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'TLSA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a TLSA record.
     */
    data?: TLSARecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: TLSARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace TLSARecord {
    /**
     * Components of a TLSA record.
     */
    export interface Data {
      /**
       * certificate.
       */
      certificate?: string;

      /**
       * Matching Type.
       */
      matching_type?: number;

      /**
       * Selector.
       */
      selector?: number;

      /**
       * Usage.
       */
      usage?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface URIRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'URI';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a URI record.
     */
    data?: URIRecord.Data;

    /**
     * Body param: Required for MX, SRV and URI records; unused by other record types.
     * Records with lower priorities are preferred.
     */
    priority?: number;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: URIRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace URIRecord {
    /**
     * Components of a URI record.
     */
    export interface Data {
      /**
       * The record content.
       */
      target?: string;

      /**
       * The record weight.
       */
      weight?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }
}

export interface RecordListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Query param:
   */
  comment?: RecordListParams.Comment;

  /**
   * Query param:
   */
  content?: RecordListParams.Content;

  /**
   * Query param: Direction to order DNS records in.
   */
  direction?: Shared.SortDirectionParam;

  /**
   * Query param: Whether to match all search requirements or at least one (any). If
   * set to `all`, acts like a logical AND between filters. If set to `any`, acts
   * like a logical OR instead. Note that the interaction between tag filters is
   * controlled by the `tag-match` parameter instead.
   */
  match?: 'any' | 'all';

  /**
   * Query param:
   */
  name?: RecordListParams.Name;

  /**
   * Query param: Field to order DNS records by.
   */
  order?: 'type' | 'name' | 'content' | 'ttl' | 'proxied';

  /**
   * Query param: Whether the record is receiving the performance and security
   * benefits of Cloudflare.
   */
  proxied?: boolean;

  /**
   * Query param: Allows searching in multiple properties of a DNS record
   * simultaneously. This parameter is intended for human users, not automation. Its
   * exact behavior is intentionally left unspecified and is subject to change in the
   * future. This parameter works independently of the `match` setting. For automated
   * searches, please use the other available parameters.
   */
  search?: string;

  /**
   * Query param:
   */
  tag?: RecordListParams.Tag;

  /**
   * Query param: Whether to match all tag search requirements or at least one (any).
   * If set to `all`, acts like a logical AND between tag filters. If set to `any`,
   * acts like a logical OR instead. Note that the regular `match` parameter is still
   * used to combine the resulting condition with other filters that aren't related
   * to tags.
   */
  tag_match?: 'any' | 'all';

  /**
   * Query param: Record type.
   */
  type?:
    | 'A'
    | 'AAAA'
    | 'CAA'
    | 'CERT'
    | 'CNAME'
    | 'DNSKEY'
    | 'DS'
    | 'HTTPS'
    | 'LOC'
    | 'MX'
    | 'NAPTR'
    | 'NS'
    | 'OPENPGPKEY'
    | 'PTR'
    | 'SMIMEA'
    | 'SRV'
    | 'SSHFP'
    | 'SVCB'
    | 'TLSA'
    | 'TXT'
    | 'URI';
}

export namespace RecordListParams {
  export interface Comment {
    /**
     * If this parameter is present, only records _without_ a comment are returned.
     */
    absent?: string;

    /**
     * Substring of the DNS record comment. Comment filters are case-insensitive.
     */
    contains?: string;

    /**
     * Suffix of the DNS record comment. Comment filters are case-insensitive.
     */
    endswith?: string;

    /**
     * Exact value of the DNS record comment. Comment filters are case-insensitive.
     */
    exact?: string;

    /**
     * If this parameter is present, only records _with_ a comment are returned.
     */
    present?: string;

    /**
     * Prefix of the DNS record comment. Comment filters are case-insensitive.
     */
    startswith?: string;
  }

  export interface Content {
    /**
     * Substring of the DNS record content. Content filters are case-insensitive.
     */
    contains?: string;

    /**
     * Suffix of the DNS record content. Content filters are case-insensitive.
     */
    endswith?: string;

    /**
     * Exact value of the DNS record content. Content filters are case-insensitive.
     */
    exact?: string;

    /**
     * Prefix of the DNS record content. Content filters are case-insensitive.
     */
    startswith?: string;
  }

  export interface Name {
    /**
     * Substring of the DNS record name. Name filters are case-insensitive.
     */
    contains?: string;

    /**
     * Suffix of the DNS record name. Name filters are case-insensitive.
     */
    endswith?: string;

    /**
     * Exact value of the DNS record name. Name filters are case-insensitive.
     */
    exact?: string;

    /**
     * Prefix of the DNS record name. Name filters are case-insensitive.
     */
    startswith?: string;
  }

  export interface Tag {
    /**
     * Name of a tag which must _not_ be present on the DNS record. Tag filters are
     * case-insensitive.
     */
    absent?: string;

    /**
     * A tag and value, of the form `<tag-name>:<tag-value>`. The API will only return
     * DNS records that have a tag named `<tag-name>` whose value contains
     * `<tag-value>`. Tag filters are case-insensitive.
     */
    contains?: string;

    /**
     * A tag and value, of the form `<tag-name>:<tag-value>`. The API will only return
     * DNS records that have a tag named `<tag-name>` whose value ends with
     * `<tag-value>`. Tag filters are case-insensitive.
     */
    endswith?: string;

    /**
     * A tag and value, of the form `<tag-name>:<tag-value>`. The API will only return
     * DNS records that have a tag named `<tag-name>` whose value is `<tag-value>`. Tag
     * filters are case-insensitive.
     */
    exact?: string;

    /**
     * Name of a tag which must be present on the DNS record. Tag filters are
     * case-insensitive.
     */
    present?: string;

    /**
     * A tag and value, of the form `<tag-name>:<tag-value>`. The API will only return
     * DNS records that have a tag named `<tag-name>` whose value starts with
     * `<tag-value>`. Tag filters are case-insensitive.
     */
    startswith?: string;
  }
}

export interface RecordDeleteParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface RecordBatchParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param:
   */
  deletes?: Array<RecordBatchParams.Delete>;

  /**
   * Body param:
   */
  patches?: Array<BatchPatchParam>;

  /**
   * Body param:
   */
  posts?: Array<
    | ARecordParam
    | AAAARecordParam
    | CNAMERecordParam
    | MXRecordParam
    | NSRecordParam
    | RecordBatchParams.DNSRecordsOpenpgpkeyRecord
    | PTRRecordParam
    | TXTRecordParam
    | CAARecordParam
    | CERTRecordParam
    | DNSKEYRecordParam
    | DSRecordParam
    | HTTPSRecordParam
    | LOCRecordParam
    | NAPTRRecordParam
    | SMIMEARecordParam
    | SRVRecordParam
    | SSHFPRecordParam
    | SVCBRecordParam
    | TLSARecordParam
    | URIRecordParam
  >;

  /**
   * Body param:
   */
  puts?: Array<BatchPutParam>;
}

export namespace RecordBatchParams {
  export interface Delete {
    /**
     * Identifier.
     */
    id: string;
  }

  export interface DNSRecordsOpenpgpkeyRecord {
    /**
     * DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Time To Live (TTL) of the DNS record in seconds. Setting to 1 means 'automatic'.
     * Value must be between 60 and 86400, with the minimum reduced to 30 for
     * Enterprise zones.
     */
    ttl: RecordsAPI.TTLParam;

    /**
     * Record type.
     */
    type: 'OPENPGPKEY';

    /**
     * Comments or notes about the DNS record. This field has no effect on DNS
     * responses.
     */
    comment?: string;

    /**
     * A single Base64-encoded OpenPGP Transferable Public Key (RFC 4880 Section 11.1)
     */
    content?: string;

    /**
     * Whether the record is receiving the performance and security benefits of
     * Cloudflare.
     */
    proxied?: boolean;

    /**
     * Settings for the DNS record.
     */
    settings?: DNSRecordsOpenpgpkeyRecord.Settings;

    /**
     * Custom tags for the DNS record. This field has no effect on DNS responses.
     */
    tags?: Array<RecordsAPI.RecordTagsParam>;
  }

  export namespace DNSRecordsOpenpgpkeyRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }
}

export type RecordEditParams =
  | RecordEditParams.ARecord
  | RecordEditParams.AAAARecord
  | RecordEditParams.CNAMERecord
  | RecordEditParams.MXRecord
  | RecordEditParams.NSRecord
  | RecordEditParams.DNSRecordsOpenpgpkeyRecord
  | RecordEditParams.PTRRecord
  | RecordEditParams.TXTRecord
  | RecordEditParams.CAARecord
  | RecordEditParams.CERTRecord
  | RecordEditParams.DNSKEYRecord
  | RecordEditParams.DSRecord
  | RecordEditParams.HTTPSRecord
  | RecordEditParams.LOCRecord
  | RecordEditParams.NAPTRRecord
  | RecordEditParams.SMIMEARecord
  | RecordEditParams.SRVRecord
  | RecordEditParams.SSHFPRecord
  | RecordEditParams.SVCBRecord
  | RecordEditParams.TLSARecord
  | RecordEditParams.URIRecord;

export declare namespace RecordEditParams {
  export interface ARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'A';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid IPv4 address.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: ARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace ARecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface AAAARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'AAAA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid IPv6 address.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: AAAARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace AAAARecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface CNAMERecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'CNAME';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid hostname. Must not match the record's name.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: CNAMERecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace CNAMERecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * If enabled, causes the CNAME record to be resolved externally and the resulting
       * address records (e.g., A and AAAA) to be returned instead of the CNAME record
       * itself. This setting is unavailable for proxied records, since they are always
       * flattened.
       */
      flatten_cname?: boolean;

      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface MXRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'MX';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid mail server hostname.
     */
    content?: string;

    /**
     * Body param: Required for MX, SRV and URI records; unused by other record types.
     * Records with lower priorities are preferred.
     */
    priority?: number;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: MXRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace MXRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface NSRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'NS';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A valid name server host name.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: NSRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace NSRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface DNSRecordsOpenpgpkeyRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'OPENPGPKEY';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: A single Base64-encoded OpenPGP Transferable Public Key (RFC 4880
     * Section 11.1)
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: DNSRecordsOpenpgpkeyRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace DNSRecordsOpenpgpkeyRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface PTRRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'PTR';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Domain name pointing to the address.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: PTRRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace PTRRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface TXTRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'TXT';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Text content for the record. The content must consist of quoted
     * "character strings" (RFC 1035), each with a length of up to 255 bytes. Strings
     * exceeding this allowed maximum length are automatically split.
     *
     * Learn more at
     * <https://www.cloudflare.com/learning/dns/dns-records/dns-txt-record/>.
     */
    content?: string;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: TXTRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace TXTRecord {
    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface CAARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'CAA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a CAA record.
     */
    data?: CAARecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: CAARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace CAARecord {
    /**
     * Components of a CAA record.
     */
    export interface Data {
      /**
       * Flags for the CAA record.
       */
      flags?: number;

      /**
       * Name of the property controlled by this record (e.g.: issue, issuewild, iodef).
       */
      tag?: string;

      /**
       * Value of the record. This field's semantics depend on the chosen tag.
       */
      value?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface CERTRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'CERT';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a CERT record.
     */
    data?: CERTRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: CERTRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace CERTRecord {
    /**
     * Components of a CERT record.
     */
    export interface Data {
      /**
       * Algorithm.
       */
      algorithm?: number;

      /**
       * Certificate.
       */
      certificate?: string;

      /**
       * Key Tag.
       */
      key_tag?: number;

      /**
       * Type.
       */
      type?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface DNSKEYRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'DNSKEY';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a DNSKEY record.
     */
    data?: DNSKEYRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: DNSKEYRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace DNSKEYRecord {
    /**
     * Components of a DNSKEY record.
     */
    export interface Data {
      /**
       * Algorithm.
       */
      algorithm?: number;

      /**
       * Flags.
       */
      flags?: number;

      /**
       * Protocol.
       */
      protocol?: number;

      /**
       * Public Key.
       */
      public_key?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface DSRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'DS';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a DS record.
     */
    data?: DSRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: DSRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace DSRecord {
    /**
     * Components of a DS record.
     */
    export interface Data {
      /**
       * Algorithm.
       */
      algorithm?: number;

      /**
       * Digest.
       */
      digest?: string;

      /**
       * Digest Type.
       */
      digest_type?: number;

      /**
       * Key Tag.
       */
      key_tag?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface HTTPSRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'HTTPS';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a HTTPS record.
     */
    data?: HTTPSRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: HTTPSRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace HTTPSRecord {
    /**
     * Components of a HTTPS record.
     */
    export interface Data {
      /**
       * priority.
       */
      priority?: number;

      /**
       * target.
       */
      target?: string;

      /**
       * value.
       */
      value?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface LOCRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'LOC';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a LOC record.
     */
    data?: LOCRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: LOCRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace LOCRecord {
    /**
     * Components of a LOC record.
     */
    export interface Data {
      /**
       * Altitude of location in meters.
       */
      altitude?: number;

      /**
       * Degrees of latitude.
       */
      lat_degrees?: number;

      /**
       * Latitude direction.
       */
      lat_direction?: 'N' | 'S';

      /**
       * Minutes of latitude.
       */
      lat_minutes?: number;

      /**
       * Seconds of latitude.
       */
      lat_seconds?: number;

      /**
       * Degrees of longitude.
       */
      long_degrees?: number;

      /**
       * Longitude direction.
       */
      long_direction?: 'E' | 'W';

      /**
       * Minutes of longitude.
       */
      long_minutes?: number;

      /**
       * Seconds of longitude.
       */
      long_seconds?: number;

      /**
       * Horizontal precision of location.
       */
      precision_horz?: number;

      /**
       * Vertical precision of location.
       */
      precision_vert?: number;

      /**
       * Size of location in meters.
       */
      size?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface NAPTRRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'NAPTR';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a NAPTR record.
     */
    data?: NAPTRRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: NAPTRRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace NAPTRRecord {
    /**
     * Components of a NAPTR record.
     */
    export interface Data {
      /**
       * Flags.
       */
      flags?: string;

      /**
       * Order.
       */
      order?: number;

      /**
       * Preference.
       */
      preference?: number;

      /**
       * Regex.
       */
      regex?: string;

      /**
       * Replacement.
       */
      replacement?: string;

      /**
       * Service.
       */
      service?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SMIMEARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SMIMEA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SMIMEA record.
     */
    data?: SMIMEARecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SMIMEARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SMIMEARecord {
    /**
     * Components of a SMIMEA record.
     */
    export interface Data {
      /**
       * Certificate.
       */
      certificate?: string;

      /**
       * Matching Type.
       */
      matching_type?: number;

      /**
       * Selector.
       */
      selector?: number;

      /**
       * Usage.
       */
      usage?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SRVRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SRV';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SRV record.
     */
    data?: SRVRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SRVRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SRVRecord {
    /**
     * Components of a SRV record.
     */
    export interface Data {
      /**
       * The port of the service.
       */
      port?: number;

      /**
       * Required for MX, SRV and URI records; unused by other record types. Records with
       * lower priorities are preferred.
       */
      priority?: number;

      /**
       * A valid hostname.
       */
      target?: string;

      /**
       * The record weight.
       */
      weight?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SSHFPRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SSHFP';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SSHFP record.
     */
    data?: SSHFPRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SSHFPRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SSHFPRecord {
    /**
     * Components of a SSHFP record.
     */
    export interface Data {
      /**
       * algorithm.
       */
      algorithm?: number;

      /**
       * fingerprint.
       */
      fingerprint?: string;

      /**
       * type.
       */
      type?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface SVCBRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'SVCB';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a SVCB record.
     */
    data?: SVCBRecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: SVCBRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace SVCBRecord {
    /**
     * Components of a SVCB record.
     */
    export interface Data {
      /**
       * priority.
       */
      priority?: number;

      /**
       * target.
       */
      target?: string;

      /**
       * value.
       */
      value?: string;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface TLSARecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'TLSA';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a TLSA record.
     */
    data?: TLSARecord.Data;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: TLSARecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace TLSARecord {
    /**
     * Components of a TLSA record.
     */
    export interface Data {
      /**
       * certificate.
       */
      certificate?: string;

      /**
       * Matching Type.
       */
      matching_type?: number;

      /**
       * Selector.
       */
      selector?: number;

      /**
       * Usage.
       */
      usage?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }

  export interface URIRecord {
    /**
     * Path param: Identifier.
     */
    zone_id: string;

    /**
     * Body param: DNS record name (or @ for the zone apex) in Punycode.
     */
    name: string;

    /**
     * Body param: Time To Live (TTL) of the DNS record in seconds. Setting to 1 means
     * 'automatic'. Value must be between 60 and 86400, with the minimum reduced to 30
     * for Enterprise zones.
     */
    ttl: TTLParam;

    /**
     * Body param: Record type.
     */
    type: 'URI';

    /**
     * Body param: Comments or notes about the DNS record. This field has no effect on
     * DNS responses.
     */
    comment?: string;

    /**
     * Body param: Components of a URI record.
     */
    data?: URIRecord.Data;

    /**
     * Body param: Required for MX, SRV and URI records; unused by other record types.
     * Records with lower priorities are preferred.
     */
    priority?: number;

    /**
     * Body param: Whether the record is receiving the performance and security
     * benefits of Cloudflare.
     */
    proxied?: boolean;

    /**
     * Body param: Settings for the DNS record.
     */
    settings?: URIRecord.Settings;

    /**
     * Body param: Custom tags for the DNS record. This field has no effect on DNS
     * responses.
     */
    tags?: Array<RecordTagsParam>;
  }

  export namespace URIRecord {
    /**
     * Components of a URI record.
     */
    export interface Data {
      /**
       * The record content.
       */
      target?: string;

      /**
       * The record weight.
       */
      weight?: number;
    }

    /**
     * Settings for the DNS record.
     */
    export interface Settings {
      /**
       * When enabled, only A records will be generated, and AAAA records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv4_only?: boolean;

      /**
       * When enabled, only AAAA records will be generated, and A records will not be
       * created. This setting is intended for exceptional cases. Note that this option
       * only applies to proxied records and it has no effect on whether Cloudflare
       * communicates with the origin using IPv4 or IPv6.
       */
      ipv6_only?: boolean;
    }
  }
}

export interface RecordExportParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface RecordGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export interface RecordImportParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: BIND config to import.
   *
   * **Tip:** When using cURL, a file can be uploaded using
   * `--form 'file=@bind_config.txt'`.
   */
  file: string;

  /**
   * Body param: Whether or not proxiable records should receive the performance and
   * security benefits of Cloudflare.
   *
   * The value should be either `true` or `false`.
   */
  proxied?: string;
}

export interface RecordScanParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param:
   */
  body: unknown;
}

Records.RecordResponsesV4PagePaginationArray = RecordResponsesV4PagePaginationArray;

export declare namespace Records {
  export {
    type ARecord as ARecord,
    type AAAARecord as AAAARecord,
    type BatchPatch as BatchPatch,
    type BatchPut as BatchPut,
    type CAARecord as CAARecord,
    type CERTRecord as CERTRecord,
    type CNAMERecord as CNAMERecord,
    type DNSKEYRecord as DNSKEYRecord,
    type DSRecord as DSRecord,
    type HTTPSRecord as HTTPSRecord,
    type LOCRecord as LOCRecord,
    type MXRecord as MXRecord,
    type NAPTRRecord as NAPTRRecord,
    type NSRecord as NSRecord,
    type PTRRecord as PTRRecord,
    type Record as Record,
    type RecordResponse as RecordResponse,
    type RecordTags as RecordTags,
    type SMIMEARecord as SMIMEARecord,
    type SRVRecord as SRVRecord,
    type SSHFPRecord as SSHFPRecord,
    type SVCBRecord as SVCBRecord,
    type TLSARecord as TLSARecord,
    type TTL as TTL,
    type TXTRecord as TXTRecord,
    type URIRecord as URIRecord,
    type RecordDeleteResponse as RecordDeleteResponse,
    type RecordBatchResponse as RecordBatchResponse,
    type RecordExportResponse as RecordExportResponse,
    type RecordImportResponse as RecordImportResponse,
    type RecordScanResponse as RecordScanResponse,
    RecordResponsesV4PagePaginationArray as RecordResponsesV4PagePaginationArray,
    type RecordCreateParams as RecordCreateParams,
    type RecordUpdateParams as RecordUpdateParams,
    type RecordListParams as RecordListParams,
    type RecordDeleteParams as RecordDeleteParams,
    type RecordBatchParams as RecordBatchParams,
    type RecordEditParams as RecordEditParams,
    type RecordExportParams as RecordExportParams,
    type RecordGetParams as RecordGetParams,
    type RecordImportParams as RecordImportParams,
    type RecordScanParams as RecordScanParams,
  };
}
