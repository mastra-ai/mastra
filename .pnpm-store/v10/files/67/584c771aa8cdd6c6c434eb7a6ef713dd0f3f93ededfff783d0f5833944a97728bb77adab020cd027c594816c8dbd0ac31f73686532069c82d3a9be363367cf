// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class AuditSSHSettings extends APIResource {
    /**
     * Updates Zero Trust Audit SSH and SSH with Access for Infrastructure settings for
     * an account.
     *
     * @example
     * ```ts
     * const gatewaySettings =
     *   await client.zeroTrust.gateway.auditSSHSettings.update({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     public_key:
     *       '1pyl6I1tL7xfJuFYVzXlUW8uXXlpxegHXBzGCBKaSFA=',
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/gateway/audit_ssh_settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets all Zero Trust Audit SSH and SSH with Access for Infrastructure settings
     * for an account.
     *
     * @example
     * ```ts
     * const gatewaySettings =
     *   await client.zeroTrust.gateway.auditSSHSettings.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/gateway/audit_ssh_settings`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Rotates the SSH account seed that is used for generating the host key identity
     * when connecting through the Cloudflare SSH Proxy.
     *
     * @example
     * ```ts
     * const gatewaySettings =
     *   await client.zeroTrust.gateway.auditSSHSettings.rotateSeed(
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    rotateSeed(params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/gateway/audit_ssh_settings/rotate_seed`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=audit-ssh-settings.mjs.map