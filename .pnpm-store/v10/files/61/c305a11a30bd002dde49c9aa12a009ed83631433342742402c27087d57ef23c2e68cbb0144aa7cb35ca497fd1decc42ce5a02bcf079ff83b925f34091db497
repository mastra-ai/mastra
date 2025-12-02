// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Apps extends APIResource {
    /**
     * Creates a new Spectrum application from a configuration using a name for the
     * origin.
     *
     * @example
     * ```ts
     * const app = await client.spectrum.apps.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   dns: {},
     *   ip_firewall: true,
     *   protocol: 'tcp/22',
     *   proxy_protocol: 'off',
     *   tls: 'full',
     *   traffic_type: 'direct',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/spectrum/apps`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a previously existing application's configuration that uses a name for
     * the origin.
     *
     * @example
     * ```ts
     * const app = await client.spectrum.apps.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     dns: {},
     *     ip_firewall: true,
     *     protocol: 'tcp/22',
     *     proxy_protocol: 'off',
     *     tls: 'full',
     *     traffic_type: 'direct',
     *   },
     * );
     * ```
     */
    update(appId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/spectrum/apps/${appId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves a list of currently existing Spectrum applications inside a zone.
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/spectrum/apps`, AppListResponsesV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Deletes a previously existing application.
     */
    delete(appId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/spectrum/apps/${appId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets the application configuration of a specific application inside a zone.
     */
    get(appId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/spectrum/apps/${appId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class AppListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Apps.AppListResponsesV4PagePaginationArray = AppListResponsesV4PagePaginationArray;
//# sourceMappingURL=apps.mjs.map