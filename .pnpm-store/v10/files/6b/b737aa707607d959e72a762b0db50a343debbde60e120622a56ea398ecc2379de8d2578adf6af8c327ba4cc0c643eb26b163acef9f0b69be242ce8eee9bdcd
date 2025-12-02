// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as LogoMatchesAPI from "./logo-matches.mjs";
import { LogoMatches } from "./logo-matches.mjs";
import * as LogosAPI from "./logos.mjs";
import { Logos } from "./logos.mjs";
import * as MatchesAPI from "./matches.mjs";
import { Matches } from "./matches.mjs";
import * as QueriesAPI from "./queries.mjs";
import { Queries } from "./queries.mjs";
export class BrandProtection extends APIResource {
    constructor() {
        super(...arguments);
        this.queries = new QueriesAPI.Queries(this._client);
        this.matches = new MatchesAPI.Matches(this._client);
        this.logos = new LogosAPI.Logos(this._client);
        this.logoMatches = new LogoMatchesAPI.LogoMatches(this._client);
    }
    /**
     * Submit suspicious URL for scanning.
     *
     * @example
     * ```ts
     * const submit = await client.brandProtection.submit({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    submit(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/brand-protection/submit`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets phishing details about a URL.
     *
     * @example
     * ```ts
     * const info = await client.brandProtection.urlInfo({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    urlInfo(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/brand-protection/url-info`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
BrandProtection.Queries = Queries;
BrandProtection.Matches = Matches;
BrandProtection.Logos = Logos;
BrandProtection.LogoMatches = LogoMatches;
//# sourceMappingURL=brand-protection.mjs.map