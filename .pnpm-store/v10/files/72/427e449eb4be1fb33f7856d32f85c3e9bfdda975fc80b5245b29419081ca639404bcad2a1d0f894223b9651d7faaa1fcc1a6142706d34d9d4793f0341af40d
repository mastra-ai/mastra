// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class OwnershipResource extends APIResource {
    /**
     * Adds an AWS or GCP bucket to use with full packet captures.
     *
     * @example
     * ```ts
     * const ownership =
     *   await client.magicTransit.pcaps.ownership.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     destination_conf: 's3://pcaps-bucket?region=us-east-1',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/pcaps/ownership`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes buckets added to the packet captures API.
     *
     * @example
     * ```ts
     * await client.magicTransit.pcaps.ownership.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(ownershipId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/pcaps/ownership/${ownershipId}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * List all buckets configured for use with PCAPs API.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ownership of client.magicTransit.pcaps.ownership.get(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/pcaps/ownership`, OwnershipsSinglePage, options);
    }
    /**
     * Validates buckets added to the packet captures API.
     *
     * @example
     * ```ts
     * const ownership =
     *   await client.magicTransit.pcaps.ownership.validate({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     destination_conf: 's3://pcaps-bucket?region=us-east-1',
     *     ownership_challenge:
     *       'ownership-challenge-9883874ecac311ec8475433579a6bf5f.txt',
     *   });
     * ```
     */
    validate(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/pcaps/ownership/validate`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
export class OwnershipsSinglePage extends SinglePage {
}
OwnershipResource.OwnershipsSinglePage = OwnershipsSinglePage;
//# sourceMappingURL=ownership.mjs.map