// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as ConfigsAPI from './configs';
import {
  ConfigCreateParams,
  ConfigDeleteParams,
  ConfigDeleteResponse,
  ConfigEditParams,
  ConfigGetParams,
  ConfigListParams,
  ConfigUpdateParams,
  Configs,
} from './configs';
import { SinglePage } from '../../pagination';

export class HyperdriveResource extends APIResource {
  configs: ConfigsAPI.Configs = new ConfigsAPI.Configs(this._client);
}

export class HyperdrivesSinglePage extends SinglePage<Hyperdrive> {}

export type Configuration = Configuration.HyperdriveInternetOrigin | Configuration.HyperdriveOverAccessOrigin;

export namespace Configuration {
  export interface HyperdriveInternetOrigin {
    /**
     * Defines the host (hostname or IP) of your origin database.
     */
    host: string;

    /**
     * Defines the port (default: 5432 for Postgres) of your origin database.
     */
    port: number;

    /**
     * Set the name of your origin database.
     */
    database?: string;

    /**
     * Specifies the URL scheme used to connect to your origin database.
     */
    scheme?: 'postgres' | 'postgresql' | 'mysql';

    /**
     * Set the user of your origin database.
     */
    user?: string;
  }

  export interface HyperdriveOverAccessOrigin {
    /**
     * Defines the Client ID of the Access token to use when connecting to the origin
     * database.
     */
    access_client_id: string;

    /**
     * Defines the host (hostname or IP) of your origin database.
     */
    host: string;

    /**
     * Set the name of your origin database.
     */
    database?: string;

    /**
     * Specifies the URL scheme used to connect to your origin database.
     */
    scheme?: 'postgres' | 'postgresql' | 'mysql';

    /**
     * Set the user of your origin database.
     */
    user?: string;
  }
}

export interface Hyperdrive {
  /**
   * Define configurations using a unique string identifier.
   */
  id: string;

  name: string;

  origin: Hyperdrive.PublicDatabase | Hyperdrive.AccessProtectedDatabaseBehindCloudflareTunnel;

  caching?: Hyperdrive.HyperdriveHyperdriveCachingCommon | Hyperdrive.HyperdriveHyperdriveCachingEnabled;

  /**
   * Defines the creation time of the Hyperdrive configuration.
   */
  created_on?: string;

  /**
   * Defines the last modified time of the Hyperdrive configuration.
   */
  modified_on?: string;

  mtls?: Hyperdrive.MTLS;

  /**
   * The (soft) maximum number of connections the Hyperdrive is allowed to make to
   * the origin database.
   */
  origin_connection_limit?: number;
}

export namespace Hyperdrive {
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
     * Set the name of your origin database.
     */
    database: string;

    /**
     * Defines the host (hostname or IP) of your origin database.
     */
    host: string;

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

HyperdriveResource.Configs = Configs;

export declare namespace HyperdriveResource {
  export { type Configuration as Configuration, type Hyperdrive as Hyperdrive };

  export {
    Configs as Configs,
    type ConfigDeleteResponse as ConfigDeleteResponse,
    type ConfigCreateParams as ConfigCreateParams,
    type ConfigUpdateParams as ConfigUpdateParams,
    type ConfigListParams as ConfigListParams,
    type ConfigDeleteParams as ConfigDeleteParams,
    type ConfigEditParams as ConfigEditParams,
    type ConfigGetParams as ConfigGetParams,
  };
}
