// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { isRequestOptions } from "../../core.mjs";
import { CloudflareError } from "../../error.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Jobs extends APIResource {
    /**
     * Creates a new Logpush job for an account or zone.
     *
     * @example
     * ```ts
     * const logpushJob = await client.logpush.jobs.create({
     *   destination_conf: 's3://mybucket/logs?region=us-west-2',
     *   account_id: 'account_id',
     *   dataset: 'gateway_dns',
     *   filter:
     *     '{"where":{"and":[{"key":"ClientRequestPath","operator":"contains","value":"/static"},{"key":"ClientRequestHost","operator":"eq","value":"example.com"}]}}',
     *   max_upload_bytes: 5000000,
     *   max_upload_interval_seconds: 30,
     *   max_upload_records: 1000,
     *   name: 'example.com',
     *   output_options: {
     *     'CVE-2021-44228': false,
     *     batch_prefix: '',
     *     batch_suffix: '',
     *     field_delimiter: ',',
     *     field_names: ['Datetime', 'DstIP', 'SrcIP'],
     *     output_type: 'ndjson',
     *     record_delimiter: '',
     *     record_prefix: '{',
     *     record_suffix: '}\n',
     *     sample_rate: 1,
     *     timestamp_format: 'unixnano',
     *   },
     * });
     * ```
     */
    create(params, options) {
        const { account_id, zone_id, ...body } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/logpush/jobs`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a Logpush job.
     *
     * @example
     * ```ts
     * const logpushJob = await client.logpush.jobs.update(1, {
     *   account_id: 'account_id',
     *   destination_conf: 's3://mybucket/logs?region=us-west-2',
     *   filter:
     *     '{"where":{"and":[{"key":"ClientRequestPath","operator":"contains","value":"/static"},{"key":"ClientRequestHost","operator":"eq","value":"example.com"}]}}',
     *   max_upload_bytes: 5000000,
     *   max_upload_interval_seconds: 30,
     *   max_upload_records: 1000,
     *   output_options: {
     *     'CVE-2021-44228': false,
     *     batch_prefix: '',
     *     batch_suffix: '',
     *     field_delimiter: ',',
     *     field_names: ['Datetime', 'DstIP', 'SrcIP'],
     *     output_type: 'ndjson',
     *     record_delimiter: '',
     *     record_prefix: '{',
     *     record_suffix: '}\n',
     *     sample_rate: 1,
     *     timestamp_format: 'unixnano',
     *   },
     * });
     * ```
     */
    update(jobId, params, options) {
        const { account_id, zone_id, ...body } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/logpush/jobs/${jobId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    list(params = {}, options) {
        if (isRequestOptions(params)) {
            return this.list({}, params);
        }
        const { account_id, zone_id } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/logpush/jobs`, LogpushJobsSinglePage, options);
    }
    delete(jobId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.delete(jobId, {}, params);
        }
        const { account_id, zone_id } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/logpush/jobs/${jobId}`, options)._thenUnwrap((obj) => obj.result);
    }
    get(jobId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.get(jobId, {}, params);
        }
        const { account_id, zone_id } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/logpush/jobs/${jobId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class LogpushJobsSinglePage extends SinglePage {
}
Jobs.LogpushJobsSinglePage = LogpushJobsSinglePage;
//# sourceMappingURL=jobs.mjs.map