// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { CursorLimitPagination } from "../../../pagination.mjs";
export class Audit extends APIResource {
    /**
     * Gets a list of audit logs for an account. <br /> <br /> This is the beta release
     * of Audit Logs Version 2. Since this is a beta version, there may be gaps or
     * missing entries in the available audit logs. Be aware of the following
     * limitations. <br /> <ul> <li>Audit logs are available only for the past 30 days.
     * <br /></li> <li>Error handling is not yet implemented. <br /> </li> </ul>
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const auditListResponse of client.accounts.logs.audit.list(
     *   {
     *     account_id: 'a67e14daa5f8dceeb91fe5449ba496ef',
     *     before: '2024-10-31',
     *     since: '2024-10-30',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/logs/audit`, AuditListResponsesCursorLimitPagination, { query, ...options });
    }
}
export class AuditListResponsesCursorLimitPagination extends CursorLimitPagination {
}
Audit.AuditListResponsesCursorLimitPagination = AuditListResponsesCursorLimitPagination;
//# sourceMappingURL=audit.mjs.map