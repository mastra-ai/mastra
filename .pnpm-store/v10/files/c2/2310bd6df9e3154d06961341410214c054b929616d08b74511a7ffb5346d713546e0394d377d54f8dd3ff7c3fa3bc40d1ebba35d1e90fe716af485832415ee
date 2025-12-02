import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Associations extends APIResource {
    /**
     * Lists all active associations between the certificate and Cloudflare services.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const certificateAsssociation of client.mtlsCertificates.associations.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(mtlsCertificateId: string, params: AssociationGetParams, options?: Core.RequestOptions): Core.PagePromise<CertificateAsssociationsSinglePage, CertificateAsssociation>;
}
export declare class CertificateAsssociationsSinglePage extends SinglePage<CertificateAsssociation> {
}
export interface CertificateAsssociation {
    /**
     * The service using the certificate.
     */
    service?: string;
    /**
     * Certificate deployment status for the given service.
     */
    status?: string;
}
export interface AssociationGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Associations {
    export { type CertificateAsssociation as CertificateAsssociation, CertificateAsssociationsSinglePage as CertificateAsssociationsSinglePage, type AssociationGetParams as AssociationGetParams, };
}
//# sourceMappingURL=associations.d.ts.map