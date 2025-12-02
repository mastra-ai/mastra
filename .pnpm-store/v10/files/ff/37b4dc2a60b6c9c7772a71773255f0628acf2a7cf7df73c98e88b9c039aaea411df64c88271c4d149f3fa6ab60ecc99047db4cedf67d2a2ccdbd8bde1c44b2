// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
import { isRequestOptions } from "../core.mjs";
import { CloudflareError } from "../error.mjs";
import { SinglePage } from "../pagination.mjs";
export class CustomPages extends APIResource {
    /**
     * Updates the configuration of an existing custom page.
     *
     * @example
     * ```ts
     * const customPage = await client.customPages.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     state: 'default',
     *     url: 'http://www.example.com',
     *     account_id: 'account_id',
     *   },
     * );
     * ```
     */
    update(identifier, params, options) {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/custom_pages/${identifier}`, {
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/custom_pages`, CustomPageListResponsesSinglePage, options);
    }
    get(identifier, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.get(identifier, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/custom_pages/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class CustomPageListResponsesSinglePage extends SinglePage {
}
CustomPages.CustomPageListResponsesSinglePage = CustomPageListResponsesSinglePage;
//# sourceMappingURL=custom-pages.mjs.map