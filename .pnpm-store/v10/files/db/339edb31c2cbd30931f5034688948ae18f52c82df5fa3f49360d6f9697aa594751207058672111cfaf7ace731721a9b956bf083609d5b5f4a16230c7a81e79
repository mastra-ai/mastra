// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Release extends APIResource {
    /**
     * Release messages from quarantine
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const releaseBulkResponse of client.emailSecurity.investigate.release.bulk(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: ['4Njp3P0STMz2c02Q'],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulk(params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/investigate/release`, ReleaseBulkResponsesSinglePage, { body: body, method: 'post', ...options });
    }
}
export class ReleaseBulkResponsesSinglePage extends SinglePage {
}
Release.ReleaseBulkResponsesSinglePage = ReleaseBulkResponsesSinglePage;
//# sourceMappingURL=release.mjs.map