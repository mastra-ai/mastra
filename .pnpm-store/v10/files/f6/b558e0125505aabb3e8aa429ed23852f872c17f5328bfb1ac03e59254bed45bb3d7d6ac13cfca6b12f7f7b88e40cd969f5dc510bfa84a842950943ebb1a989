// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as HyperdriveAPI from './hyperdrive';
import { HyperdrivesSinglePage } from './hyperdrive';

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
  create(
    params: ConfigCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<HyperdriveAPI.Hyperdrive> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/hyperdrive/configs`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: HyperdriveAPI.Hyperdrive }>
    )._thenUnwrap((obj) => obj.result);
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
  update(
    hyperdriveId: string,
    params: ConfigUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<HyperdriveAPI.Hyperdrive> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/hyperdrive/configs/${hyperdriveId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: HyperdriveAPI.Hyperdrive }>
    )._thenUnwrap((obj) => obj.result);
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
  list(
    params: ConfigListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<HyperdrivesSinglePage, HyperdriveAPI.Hyperdrive> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/hyperdrive/configs`,
      HyperdrivesSinglePage,
      options,
    );
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
  delete(
    hyperdriveId: string,
    params: ConfigDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ConfigDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/hyperdrive/configs/${hyperdriveId}`,
        options,
      ) as Core.APIPromise<{ result: ConfigDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
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
  edit(
    hyperdriveId: string,
    params: ConfigEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<HyperdriveAPI.Hyperdrive> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/hyperdrive/configs/${hyperdriveId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: HyperdriveAPI.Hyperdrive }>
    )._thenUnwrap((obj) => obj.result);
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
  get(
    hyperdriveId: string,
    params: ConfigGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<HyperdriveAPI.Hyperdrive> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/hyperdrive/configs/${hyperdriveId}`,
        options,
      ) as Core.APIPromise<{ result: HyperdriveAPI.Hyperdrive }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type ConfigDeleteResponse = unknown;

export interface ConfigCreateParams {
  /**
   * Path param: Define configurations using a unique string identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  name: string;

  /**
   * Body param:
   */
  origin:
    | ConfigCreateParams.PublicDatabase
    | ConfigCreateParams.AccessProtectedDatabaseBehindCloudflareTunnel;

  /**
   * Body param:
   */
  caching?:
    | ConfigCreateParams.HyperdriveHyperdriveCachingCommon
    | ConfigCreateParams.HyperdriveHyperdriveCachingEnabled;

  /**
   * Body param:
   */
  mtls?: ConfigCreateParams.MTLS;

  /**
   * Body param: The (soft) maximum number of connections the Hyperdrive is allowed
   * to make to the origin database.
   */
  origin_connection_limit?: number;
}

export namespace ConfigCreateParams {
  export interface PublicDatabase {
    /**
     * Set the name of your origin database.
     */
    database: string;

    /**
     * Defines the host (hostname or IP) of your origin database.
     */
    host: string;

    /**
     * Set the password needed to access your origin database. The API never returns
     * this write-only value.
     */
    password: string;

    /**
     * Defines the port (default: 5432 for Postgres) of your origin database.
     */
    port: number;

    /**
     * Specifies the URL scheme used to connect to your origin database.
     */
    scheme: 'postgres' | 'postgresql' | 'mysql';

    /**
     * Set the user of your origin database.
     */
    user: string;
  }

  export interface AccessProtectedDatabaseBehindCloudflareTunnel {
    /**
     * Defines the Client ID of the Access token to use when connecting to the origin
     * database.
     */
    access_client_id: string;

    /**
     * Defines the Client Secret of the Access Token to use when connecting to the
     * origin database. The API never returns this write-only value.
     */
    access_client_secret: string;

    /**
     * Set the name of your origin database.
     */
    database: string;

    /**
     * Defines the host (hostname or IP) of your origin database.
     */
    host: string;

    /**
     * Set the password needed to access your origin database. The API never returns
     * this write-only value.
     */
    password: string;

    /**
     * Specifies the URL scheme used to connect to your origin database.
     */
    scheme: 'postgres' | 'postgresql' | 'mysql';

    /**
     * Set the user of your origin database.
     */
    user: string;
  }

  export interface HyperdriveHyperdriveCachingCommon {
    /**
     * Set to true to disable caching of SQL responses. Default is false.
     */
    disabled?: boolean;
  }

  export interface HyperdriveHyperdriveCachingEnabled {
    /**
     * Set to true to disable caching of SQL responses. Default is false.
     */
    disabled?: boolean;

    /**
     * Specify the maximum duration items should persist in the cache. Not returned if
     * set to the default (60).
     */
    max_age?: number;

    /**
     * Specify the number of seconds the cache may serve a stale response. Omitted if
     * set to the default (15).
     */
    stale_while_revalidate?: number;
  }

  export interface MTLS {
    /**
     * Define CA certificate ID obtained after uploading CA cert.
     */
    ca_certificate_id?: string;

    /**
     * Define mTLS certificate ID obtained after uploading client cert.
     */
    mtls_certificate_id?: string;

    /**
     * Set SSL mode to 'require', 'verify-ca', or 'verify-full' to verify the CA.
     */
    sslmode?: string;
  }
}

export interface ConfigUpdateParams {
  /**
   * Path param: Define configurations using a unique string identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  name: string;

  /**
   * Body param:
   */
  origin:
    | ConfigUpdateParams.PublicDatabase
    | ConfigUpdateParams.AccessProtectedDatabaseBehindCloudflareTunnel;

  /**
   * Body param:
   */
  caching?:
    | ConfigUpdateParams.HyperdriveHyperdriveCachingCommon
    | ConfigUpdateParams.HyperdriveHyperdriveCachingEnabled;

  /**
   * Body param:
   */
  mtls?: ConfigUpdateParams.MTLS;

  /**
   * Body param: The (soft) maximum number of connections the Hyperdrive is allowed
   * to make to the origin database.
   */
  origin_connection_limit?: number;
}

export namespace ConfigUpdateParams {
  export interface PublicDatabase {
    /**
     * Set the name of your origin database.
     */
    database: string;

    /**
     * Defines the host (hostname or IP) of your origin database.
     */
    host: string;

    /**
     * Set the password needed to access your origin database. The API never returns
     * this write-only value.
     */
    password: string;

    /**
     * Defines the port (default: 5432 for Postgres) of your origin database.
     */
    port: number;

    /**
     * Specifies the URL scheme used to connect to your origin database.
     */
    scheme: 'postgres' | 'postgresql' | 'mysql';

    /**
     * Set the user of your origin database.
     */
    user: string;
  }

  export interface AccessProtectedDatabaseBehindCloudflareTunnel {
    /**
     * Defines the Client ID of the Access token to use when connecting to the origin
     * database.
     */
    access_client_id: string;

    /**
     * Defines the Client Secret of the Access Token to use when connecting to the
     * origin database. The API never returns this write-only value.
     */
    access_client_secret: string;

    /**
     * Set the name of your origin database.
     */
    database: string;

    /**
     * Defines the host (hostname or IP) of your origin database.
     */
    host: string;

    /**
     * Set the password needed to access your origin database. The API never returns
     * this write-only value.
     */
    password: string;

    /**
     * Specifies the URL scheme used to connect to your origin database.
     */
    scheme: 'postgres' | 'postgresql' | 'mysql';

    /**
     * Set the user of your origin database.
     */
    user: string;
  }

  export interface HyperdriveHyperdriveCachingCommon {
    /**
     * Set to true to disable caching of SQL responses. Default is false.
     */
    disabled?: boolean;
  }

  export interface HyperdriveHyperdriveCachingEnabled {
    /**
     * Set to true to disable caching of SQL responses. Default is false.
     */
    disabled?: boolean;

    /**
     * Specify the maximum duration items should persist in the cache. Not returned if
     * set to the default (60).
     */
    max_age?: number;

    /**
     * Specify the number of seconds the cache may serve a stale response. Omitted if
     * set to the default (15).
     */
    stale_while_revalidate?: number;
  }

  export interface MTLS {
    /**
     * Define CA certificate ID obtained after uploading CA cert.
     */
    ca_certificate_id?: string;

    /**
     * Define mTLS certificate ID obtained after uploading client cert.
     */
    mtls_certificate_id?: string;

    /**
     * Set SSL mode to 'require', 'verify-ca', or 'verify-full' to verify the CA.
     */
    sslmode?: string;
  }
}

export interface ConfigListParams {
  /**
   * Define configurations using a unique string identifier.
   */
  account_id: string;
}

export interface ConfigDeleteParams {
  /**
   * Define configurations using a unique string identifier.
   */
  account_id: string;
}

export interface ConfigEditParams {
  /**
   * Path param: Define configurations using a unique string identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  caching?:
    | ConfigEditParams.HyperdriveHyperdriveCachingCommon
    | ConfigEditParams.HyperdriveHyperdriveCachingEnabled;

  /**
   * Body param:
   */
  mtls?: ConfigEditParams.MTLS;

  /**
   * Body param:
   */
  name?: string;

  /**
   * Body param:
   */
  origin?:
    | ConfigEditParams.HyperdriveHyperdriveDatabase
    | ConfigEditParams.HyperdriveInternetOrigin
    | ConfigEditParams.HyperdriveOverAccessOrigin;

  /**
   * Body param: The (soft) maximum number of connections the Hyperdrive is allowed
   * to make to the origin database.
   */
  origin_connection_limit?: number;
}

export namespace ConfigEditParams {
  export interface HyperdriveHyperdriveCachingCommon {
    /**
     * Set to true to disable caching of SQL responses. Default is false.
     */
    disabled?: boolean;
  }

  export interface HyperdriveHyperdriveCachingEnabled {
    /**
     * Set to true to disable caching of SQL responses. Default is false.
     */
    disabled?: boolean;

    /**
     * Specify the maximum duration items should persist in the cache. Not returned if
     * set to the default (60).
     */
    max_age?: number;

    /**
     * Specify the number of seconds the cache may serve a stale response. Omitted if
     * set to the default (15).
     */
    stale_while_revalidate?: number;
  }

  export interface MTLS {
    /**
     * Define CA certificate ID obtained after uploading CA cert.
     */
    ca_certificate_id?: string;

    /**
     * Define mTLS certificate ID obtained after uploading client cert.
     */
    mtls_certificate_id?: string;

    /**
     * Set SSL mode to 'require', 'verify-ca', or 'verify-full' to verify the CA.
     */
    sslmode?: string;
  }

  export interface HyperdriveHyperdriveDatabase {
    /**
     * Set the name of your origin database.
     */
    database?: string;

    /**
     * Set the password needed to access your origin database. The API never returns
     * this write-only value.
     */
    password?: string;

    /**
     * Specifies the URL scheme used to connect to your origin database.
     */
    scheme?: 'postgres' | 'postgresql' | 'mysql';

    /**
     * Set the user of your origin database.
     */
    user?: string;
  }

  export interface HyperdriveInternetOrigin {
    /**
     * Defines the host (hostname or IP) of your origin database.
     */
    host: string;

    /**
     * Defines the port (default: 5432 for Postgres) of your origin database.
     */
    port: number;
  }

  export interface HyperdriveOverAccessOrigin {
    /**
     * Defines the Client ID of the Access token to use when connecting to the origin
     * database.
     */
    access_client_id: string;

    /**
     * Defines the Client Secret of the Access Token to use when connecting to the
     * origin database. The API never returns this write-only value.
     */
    access_client_secret: string;

    /**
     * Defines the host (hostname or IP) of your origin database.
     */
    host: string;
  }
}

export interface ConfigGetParams {
  /**
   * Define configurations using a unique string identifier.
   */
  account_id: string;
}

export declare namespace Configs {
  export {
    type ConfigDeleteResponse as ConfigDeleteResponse,
    type ConfigCreateParams as ConfigCreateParams,
    type ConfigUpdateParams as ConfigUpdateParams,
    type ConfigListParams as ConfigListParams,
    type ConfigDeleteParams as ConfigDeleteParams,
    type ConfigEditParams as ConfigEditParams,
    type ConfigGetParams as ConfigGetParams,
  };
}

export { HyperdrivesSinglePage };
