// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as ConfigsAPI from "./configs.mjs";
import { Configs } from "./configs.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class History extends APIResource {
    constructor() {
        super(...arguments);
        this.configs = new ConfigsAPI.Configs(this._client);
    }
    /**
     * Restores a historical published Zaraz configuration by ID for a zone.
     *
     * @example
     * ```ts
     * const configuration = await client.zaraz.history.update({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   body: 12345,
     * });
     * ```
     */
    update(params, options) {
        const { zone_id, body } = params;
        return this._client.put(`/zones/${zone_id}/settings/zaraz/history`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists a history of published Zaraz configuration records for a zone.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const historyListResponse of client.zaraz.history.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/settings/zaraz/history`, HistoryListResponsesSinglePage, { query, ...options });
    }
}
export class HistoryListResponsesSinglePage extends SinglePage {
}
History.HistoryListResponsesSinglePage = HistoryListResponsesSinglePage;
History.Configs = Configs;
//# sourceMappingURL=history.mjs.map