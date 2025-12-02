import { APIResource } from "../resource.js";
import * as Core from "../core.js";
export declare class OriginPostQuantumEncryption extends APIResource {
    /**
     * Instructs Cloudflare to use Post-Quantum (PQ) key agreement algorithms when
     * connecting to your origin. Preferred instructs Cloudflare to opportunistically
     * send a Post-Quantum keyshare in the first message to the origin (for fastest
     * connections when the origin supports and prefers PQ), supported means that PQ
     * algorithms are advertised but only used when requested by the origin, and off
     * means that PQ algorithms are not advertised
     */
    update(params: OriginPostQuantumEncryptionUpdateParams, options?: Core.RequestOptions): Core.APIPromise<OriginPostQuantumEncryptionUpdateResponse>;
    /**
     * Instructs Cloudflare to use Post-Quantum (PQ) key agreement algorithms when
     * connecting to your origin. Preferred instructs Cloudflare to opportunistically
     * send a Post-Quantum keyshare in the first message to the origin (for fastest
     * connections when the origin supports and prefers PQ), supported means that PQ
     * algorithms are advertised but only used when requested by the origin, and off
     * means that PQ algorithms are not advertised
     */
    get(params: OriginPostQuantumEncryptionGetParams, options?: Core.RequestOptions): Core.APIPromise<OriginPostQuantumEncryptionGetResponse>;
}
export interface OriginPostQuantumEncryptionUpdateResponse {
    /**
     * Value of the zone setting.
     */
    id: 'origin_pqe';
    /**
     * Whether the setting is editable
     */
    editable: boolean;
    /**
     * The value of the feature
     */
    value: 'preferred' | 'supported' | 'off';
    /**
     * Last time this setting was modified.
     */
    modified_on?: string | null;
}
export interface OriginPostQuantumEncryptionGetResponse {
    /**
     * Value of the zone setting.
     */
    id: 'origin_pqe';
    /**
     * Whether the setting is editable
     */
    editable: boolean;
    /**
     * The value of the feature
     */
    value: 'preferred' | 'supported' | 'off';
    /**
     * Last time this setting was modified.
     */
    modified_on?: string | null;
}
export interface OriginPostQuantumEncryptionUpdateParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Body param: Value of the Origin Post Quantum Encryption Setting.
     */
    value: 'preferred' | 'supported' | 'off';
}
export interface OriginPostQuantumEncryptionGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace OriginPostQuantumEncryption {
    export { type OriginPostQuantumEncryptionUpdateResponse as OriginPostQuantumEncryptionUpdateResponse, type OriginPostQuantumEncryptionGetResponse as OriginPostQuantumEncryptionGetResponse, type OriginPostQuantumEncryptionUpdateParams as OriginPostQuantumEncryptionUpdateParams, type OriginPostQuantumEncryptionGetParams as OriginPostQuantumEncryptionGetParams, };
}
//# sourceMappingURL=origin-post-quantum-encryption.d.ts.map