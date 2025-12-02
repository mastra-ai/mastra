// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as SippyAPI from '../buckets/sippy';

export class ConnectivityPrecheck extends APIResource {
  /**
   * Check whether tokens are valid against the source bucket
   *
   * @example
   * ```ts
   * const response =
   *   await client.r2.superSlurper.connectivityPrecheck.source({
   *     account_id: 'account_id',
   *   });
   * ```
   */
  source(
    params: ConnectivityPrecheckSourceParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ConnectivityPrecheckSourceResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/slurper/source/connectivity-precheck`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ConnectivityPrecheckSourceResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Check whether tokens are valid against the target bucket
   *
   * @example
   * ```ts
   * const response =
   *   await client.r2.superSlurper.connectivityPrecheck.target({
   *     account_id: 'account_id',
   *   });
   * ```
   */
  target(
    params: ConnectivityPrecheckTargetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ConnectivityPrecheckTargetResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/slurper/target/connectivity-precheck`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ConnectivityPrecheckTargetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ConnectivityPrecheckSourceResponse {
  connectivityStatus?: 'success' | 'error';
}

export interface ConnectivityPrecheckTargetResponse {
  connectivityStatus?: 'success' | 'error';
}

export type ConnectivityPrecheckSourceParams =
  | ConnectivityPrecheckSourceParams.R2SlurperS3SourceSchema
  | ConnectivityPrecheckSourceParams.R2SlurperGcsSourceSchema
  | ConnectivityPrecheckSourceParams.R2SlurperR2SourceSchema;

export declare namespace ConnectivityPrecheckSourceParams {
  export interface R2SlurperS3SourceSchema {
    /**
     * Path param:
     */
    account_id: string;

    /**
     * Body param:
     */
    bucket?: string;

    /**
     * Body param:
     */
    endpoint?: string | null;

    /**
     * Body param:
     */
    secret?: R2SlurperS3SourceSchema.Secret;

    /**
     * Body param:
     */
    vendor?: 's3';
  }

  export namespace R2SlurperS3SourceSchema {
    export interface Secret {
      accessKeyId?: string;

      secretAccessKey?: string;
    }
  }

  export interface R2SlurperGcsSourceSchema {
    /**
     * Path param:
     */
    account_id: string;

    /**
     * Body param:
     */
    bucket?: string;

    /**
     * Body param:
     */
    secret?: R2SlurperGcsSourceSchema.Secret;

    /**
     * Body param:
     */
    vendor?: 'gcs';
  }

  export namespace R2SlurperGcsSourceSchema {
    export interface Secret {
      clientEmail?: string;

      privateKey?: string;
    }
  }

  export interface R2SlurperR2SourceSchema {
    /**
     * Path param:
     */
    account_id: string;

    /**
     * Body param:
     */
    bucket?: string;

    /**
     * Body param:
     */
    jurisdiction?: 'default' | 'eu' | 'fedramp';

    /**
     * Body param:
     */
    secret?: R2SlurperR2SourceSchema.Secret;

    /**
     * Body param:
     */
    vendor?: SippyAPI.ProviderParam;
  }

  export namespace R2SlurperR2SourceSchema {
    export interface Secret {
      accessKeyId?: string;

      secretAccessKey?: string;
    }
  }
}

export interface ConnectivityPrecheckTargetParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  bucket?: string;

  /**
   * Body param:
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';

  /**
   * Body param:
   */
  secret?: ConnectivityPrecheckTargetParams.Secret;

  /**
   * Body param:
   */
  vendor?: SippyAPI.ProviderParam;
}

export namespace ConnectivityPrecheckTargetParams {
  export interface Secret {
    accessKeyId?: string;

    secretAccessKey?: string;
  }
}

export declare namespace ConnectivityPrecheck {
  export {
    type ConnectivityPrecheckSourceResponse as ConnectivityPrecheckSourceResponse,
    type ConnectivityPrecheckTargetResponse as ConnectivityPrecheckTargetResponse,
    type ConnectivityPrecheckSourceParams as ConnectivityPrecheckSourceParams,
    type ConnectivityPrecheckTargetParams as ConnectivityPrecheckTargetParams,
  };
}
