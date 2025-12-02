"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scans = void 0;
const resource_1 = require("../../resource.js");
class Scans extends resource_1.APIResource {
    /**
     * Submit a URL to scan. Check limits at
     * https://developers.cloudflare.com/security-center/investigate/scan-limits/.
     *
     * @example
     * ```ts
     * const scan = await client.urlScanner.scans.create({
     *   account_id: 'account_id',
     *   url: 'https://www.example.com',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/urlscanner/v2/scan`, { body, ...options });
    }
    /**
     * Use a subset of ElasticSearch Query syntax to filter scans. Some example
     * queries:<br/> <br/>- 'path:"/bundles/jquery.js"': Searches for scans who
     * requested resources with the given path.<br/>- 'page.asn:AS24940 AND hash:xxx':
     * Websites hosted in AS24940 where a resource with the given hash was
     * downloaded.<br/>- 'page.domain:microsoft\* AND verdicts.malicious:true AND NOT
     * page.domain:microsoft.com': malicious scans whose hostname starts with
     * "microsoft".<br/>- 'apikey:me AND date:[2025-01 TO 2025-02]': my scans from 2025
     * January to 2025 February.
     *
     * @example
     * ```ts
     * const scans = await client.urlScanner.scans.list({
     *   account_id: 'account_id',
     * });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/urlscanner/v2/search`, { query, ...options });
    }
    /**
     * Submit URLs to scan. Check limits at
     * https://developers.cloudflare.com/security-center/investigate/scan-limits/ and
     * take into account scans submitted in bulk have lower priority and may take
     * longer to finish.
     *
     * @example
     * ```ts
     * const response = await client.urlScanner.scans.bulkCreate({
     *   account_id: 'account_id',
     * });
     * ```
     */
    bulkCreate(params, options) {
        const { account_id, body } = params ?? {};
        return this._client.post(`/accounts/${account_id}/urlscanner/v2/bulk`, { body: body, ...options });
    }
    /**
     * Returns a plain text response, with the scan's DOM content as rendered by
     * Chrome.
     *
     * @example
     * ```ts
     * const response = await client.urlScanner.scans.dom(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    dom(scanId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/urlscanner/v2/dom/${scanId}`, {
            ...options,
            headers: { Accept: 'text/plain', ...options?.headers },
        });
    }
    /**
     * Get URL scan by uuid
     *
     * @example
     * ```ts
     * const scan = await client.urlScanner.scans.get(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(scanId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/urlscanner/v2/result/${scanId}`, options);
    }
    /**
     * Get a URL scan's HAR file. See HAR spec at
     * http://www.softwareishard.com/blog/har-12-spec/.
     *
     * @example
     * ```ts
     * const response = await client.urlScanner.scans.har(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    har(scanId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/urlscanner/v2/har/${scanId}`, options);
    }
    /**
     * Get scan's screenshot by resolution (desktop/mobile/tablet).
     *
     * @example
     * ```ts
     * const response = await client.urlScanner.scans.screenshot(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     *
     * const content = await response.blob();
     * console.log(content);
     * ```
     */
    screenshot(scanId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/urlscanner/v2/screenshots/${scanId}.png`, {
            query,
            ...options,
            headers: { Accept: 'image/png', ...options?.headers },
            __binaryResponse: true,
        });
    }
}
exports.Scans = Scans;
//# sourceMappingURL=scans.js.map