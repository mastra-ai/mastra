// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';

export class OriginPostQuantumEncryption extends APIResource {
  /**
   * Instructs Cloudflare to use Post-Quantum (PQ) key agreement algorithms when
   * connecting to your origin. Preferred instructs Cloudflare to opportunistically
   * send a Post-Quantum keyshare in the first message to the origin (for fastest
   * connections when the origin supports and prefers PQ), supported means that PQ
   * algorithms are advertised but only used when requested by the origin, and off
   * means that PQ algorithms are not advertised
   */
  update(
    params: OriginPostQuantumEncryptionUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OriginPostQuantumEncryptionUpdateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.put(`/zones/${zone_id}/cache/origin_post_quantum_encryption`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: OriginPostQuantumEncryptionUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Instructs Cloudflare to use Post-Quantum (PQ) key agreement algorithms when
   * connecting to your origin. Preferred instructs Cloudflare to opportunistically
   * send a Post-Quantum keyshare in the first message to the origin (for fastest
   * connections when the origin supports and prefers PQ), supported means that PQ
   * algorithms are advertised but only used when requested by the origin, and off
   * means that PQ algorithms are not advertised
   */
  get(
    params: OriginPostQuantumEncryptionGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<OriginPostQuantumEncryptionGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/cache/origin_post_quantum_encryption`, options) as Core.APIPromise<{
        result: OriginPostQuantumEncryptionGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
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
  export {
    type OriginPostQuantumEncryptionUpdateResponse as OriginPostQuantumEncryptionUpdateResponse,
    type OriginPostQuantumEncryptionGetResponse as OriginPostQuantumEncryptionGetResponse,
    type OriginPostQuantumEncryptionUpdateParams as OriginPostQuantumEncryptionUpdateParams,
    type OriginPostQuantumEncryptionGetParams as OriginPostQuantumEncryptionGetParams,
  };
}
