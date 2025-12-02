// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
export class OriginPostQuantumEncryption extends APIResource {
    /**
     * Instructs Cloudflare to use Post-Quantum (PQ) key agreement algorithms when
     * connecting to your origin. Preferred instructs Cloudflare to opportunistically
     * send a Post-Quantum keyshare in the first message to the origin (for fastest
     * connections when the origin supports and prefers PQ), supported means that PQ
     * algorithms are advertised but only used when requested by the origin, and off
     * means that PQ algorithms are not advertised
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/cache/origin_post_quantum_encryption`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Instructs Cloudflare to use Post-Quantum (PQ) key agreement algorithms when
     * connecting to your origin. Preferred instructs Cloudflare to opportunistically
     * send a Post-Quantum keyshare in the first message to the origin (for fastest
     * connections when the origin supports and prefers PQ), supported means that PQ
     * algorithms are advertised but only used when requested by the origin, and off
     * means that PQ algorithms are not advertised
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/cache/origin_post_quantum_encryption`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=origin-post-quantum-encryption.mjs.map