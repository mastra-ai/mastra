// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Downloads extends APIResource {
    /**
     * Downloads artifacts for an executed command. Bulk downloads are not supported
     *
     * @example
     * ```ts
     * const download =
     *   await client.zeroTrust.dex.commands.downloads.get(
     *     '5758fefe-ae7e-4538-a39b-1fef6abcb909',
     *     'filename',
     *     { account_id: '01a7362d577a6c3019a474fd6f485823' },
     *   );
     *
     * const content = await download.blob();
     * console.log(content);
     * ```
     */
    get(commandId, filename, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dex/commands/${commandId}/downloads/${filename}`, {
            ...options,
            headers: { Accept: 'application/zip', ...options?.headers },
            __binaryResponse: true,
        });
    }
}
//# sourceMappingURL=downloads.mjs.map