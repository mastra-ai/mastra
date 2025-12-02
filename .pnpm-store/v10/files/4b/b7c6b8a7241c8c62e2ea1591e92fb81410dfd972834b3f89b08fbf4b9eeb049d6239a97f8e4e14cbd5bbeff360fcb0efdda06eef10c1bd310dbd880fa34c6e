// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class PDF extends APIResource {
    /**
     * Fetches rendered PDF from provided URL or HTML. Check available options like
     * `gotoOptions` and `waitFor*` to control page load behaviour.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/pdf`, {
            query: { cacheTTL },
            body,
            ...options,
            headers: { Accept: 'application/pdf', ...options?.headers },
            __binaryResponse: true,
        });
    }
}
//# sourceMappingURL=pdf.mjs.map