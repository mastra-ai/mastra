// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { HyperdrivesSinglePage } from "./hyperdrive.mjs";
export class Configs extends APIResource {
    /**
     * Creates and returns a new Hyperdrive configuration.
     *
     * @example
     * ```ts
     * const hyperdrive = await client.hyperdrive.configs.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'example-hyperdrive',
     *   origin: {
     *     database: 'postgres',
     *     host: 'database.example.com',
     *     password: 'password',
     *     port: 5432,
     *     scheme: 'postgres',
     *     user: 'postgres',
     *   },
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/hyperdrive/configs`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates and returns the specified Hyperdrive configuration.
     *
     * @example
     * ```ts
     * const hyperdrive = await client.hyperdrive.configs.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'example-hyperdrive',
     *     origin: {
     *       database: 'postgres',
     *       host: 'database.example.com',
     *       password: 'password',
     *       port: 5432,
     *       scheme: 'postgres',
     *       user: 'postgres',
     *     },
     *   },
     * );
     * ```
     */
    update(hyperdriveId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/hyperdrive/configs/${hyperdriveId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns a list of Hyperdrives.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const hyperdrive of client.hyperdrive.configs.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/hyperdrive/configs`, HyperdrivesSinglePage, options);
    }
    /**
     * Deletes the specified Hyperdrive.
     *
     * @example
     * ```ts
     * const config = await client.hyperdrive.configs.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(hyperdriveId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/hyperdrive/configs/${hyperdriveId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patches and returns the specified Hyperdrive configuration. Custom caching
     * settings are not kept if caching is disabled.
     *
     * @example
     * ```ts
     * const hyperdrive = await client.hyperdrive.configs.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(hyperdriveId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/hyperdrive/configs/${hyperdriveId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns the specified Hyperdrive configuration.
     *
     * @example
     * ```ts
     * const hyperdrive = await client.hyperdrive.configs.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(hyperdriveId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/hyperdrive/configs/${hyperdriveId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export { HyperdrivesSinglePage };
//# sourceMappingURL=configs.mjs.map