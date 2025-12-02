"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OriginPostQuantumEncryption = void 0;
const resource_1 = require("../resource.js");
class OriginPostQuantumEncryption extends resource_1.APIResource {
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
exports.OriginPostQuantumEncryption = OriginPostQuantumEncryption;
//# sourceMappingURL=origin-post-quantum-encryption.js.map