// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as AccountSettingsAPI from './account-settings';
import {
  AccountSettingGetParams,
  AccountSettingGetResponse,
  AccountSettingUpdateParams,
  AccountSettingUpdateResponse,
  AccountSettings,
} from './account-settings';
import * as DomainsAPI from './domains';
import {
  Domain,
  DomainDeleteParams,
  DomainGetParams,
  DomainListParams,
  DomainUpdateParams,
  Domains,
  DomainsSinglePage,
} from './domains';
import * as RoutesAPI from './routes';
import {
  RouteCreateParams,
  RouteCreateResponse,
  RouteDeleteParams,
  RouteDeleteResponse,
  RouteGetParams,
  RouteGetResponse,
  RouteListParams,
  RouteListResponse,
  RouteListResponsesSinglePage,
  RouteUpdateParams,
  RouteUpdateResponse,
  Routes,
} from './routes';
import * as SubdomainsAPI from './subdomains';
import {
  SubdomainGetParams,
  SubdomainGetResponse,
  SubdomainUpdateParams,
  SubdomainUpdateResponse,
  Subdomains,
} from './subdomains';
import * as AssetsAPI from './assets/assets';
import { Assets } from './assets/assets';
import * as ObservabilityAPI from './observability/observability';
import { Observability } from './observability/observability';
import * as ScriptsAPI from './scripts/scripts';
import {
  Script,
  ScriptDeleteParams,
  ScriptDeleteResponse,
  ScriptGetParams,
  ScriptGetResponse,
  ScriptListParams,
  ScriptSetting,
  ScriptUpdateParams,
  ScriptUpdateResponse,
  Scripts,
  ScriptsSinglePage,
} from './scripts/scripts';

export class Workers extends APIResource {
  routes: RoutesAPI.Routes = new RoutesAPI.Routes(this._client);
  assets: AssetsAPI.Assets = new AssetsAPI.Assets(this._client);
  scripts: ScriptsAPI.Scripts = new ScriptsAPI.Scripts(this._client);
  accountSettings: AccountSettingsAPI.AccountSettings = new AccountSettingsAPI.AccountSettings(this._client);
  domains: DomainsAPI.Domains = new DomainsAPI.Domains(this._client);
  subdomains: SubdomainsAPI.Subdomains = new SubdomainsAPI.Subdomains(this._client);
  observability: ObservabilityAPI.Observability = new ObservabilityAPI.Observability(this._client);
}

export interface MigrationStep {
  /**
   * A list of classes to delete Durable Object namespaces from.
   */
  deleted_classes?: Array<string>;

  /**
   * A list of classes to create Durable Object namespaces from.
   */
  new_classes?: Array<string>;

  /**
   * A list of classes to create Durable Object namespaces with SQLite from.
   */
  new_sqlite_classes?: Array<string>;

  /**
   * A list of classes with Durable Object namespaces that were renamed.
   */
  renamed_classes?: Array<MigrationStep.RenamedClass>;

  /**
   * A list of transfers for Durable Object namespaces from a different Worker and
   * class to a class defined in this Worker.
   */
  transferred_classes?: Array<MigrationStep.TransferredClass>;
}

export namespace MigrationStep {
  export interface RenamedClass {
    from?: string;

    to?: string;
  }

  export interface TransferredClass {
    from?: string;

    from_script?: string;

    to?: string;
  }
}

export interface MigrationStepParam {
  /**
   * A list of classes to delete Durable Object namespaces from.
   */
  deleted_classes?: Array<string>;

  /**
   * A list of classes to create Durable Object namespaces from.
   */
  new_classes?: Array<string>;

  /**
   * A list of classes to create Durable Object namespaces with SQLite from.
   */
  new_sqlite_classes?: Array<string>;

  /**
   * A list of classes with Durable Object namespaces that were renamed.
   */
  renamed_classes?: Array<MigrationStepParam.RenamedClass>;

  /**
   * A list of transfers for Durable Object namespaces from a different Worker and
   * class to a class defined in this Worker.
   */
  transferred_classes?: Array<MigrationStepParam.TransferredClass>;
}

export namespace MigrationStepParam {
  export interface RenamedClass {
    from?: string;

    to?: string;
  }

  export interface TransferredClass {
    from?: string;

    from_script?: string;

    to?: string;
  }
}

/**
 * A single set of migrations to apply.
 */
export interface SingleStepMigration {
  /**
   * A list of classes to delete Durable Object namespaces from.
   */
  deleted_classes?: Array<string>;

  /**
   * A list of classes to create Durable Object namespaces from.
   */
  new_classes?: Array<string>;

  /**
   * A list of classes to create Durable Object namespaces with SQLite from.
   */
  new_sqlite_classes?: Array<string>;

  /**
   * Tag to set as the latest migration tag.
   */
  new_tag?: string;

  /**
   * Tag used to verify against the latest migration tag for this Worker. If they
   * don't match, the upload is rejected.
   */
  old_tag?: string;

  /**
   * A list of classes with Durable Object namespaces that were renamed.
   */
  renamed_classes?: Array<SingleStepMigration.RenamedClass>;

  /**
   * A list of transfers for Durable Object namespaces from a different Worker and
   * class to a class defined in this Worker.
   */
  transferred_classes?: Array<SingleStepMigration.TransferredClass>;
}

export namespace SingleStepMigration {
  export interface RenamedClass {
    from?: string;

    to?: string;
  }

  export interface TransferredClass {
    from?: string;

    from_script?: string;

    to?: string;
  }
}

/**
 * A single set of migrations to apply.
 */
export interface SingleStepMigrationParam {
  /**
   * A list of classes to delete Durable Object namespaces from.
   */
  deleted_classes?: Array<string>;

  /**
   * A list of classes to create Durable Object namespaces from.
   */
  new_classes?: Array<string>;

  /**
   * A list of classes to create Durable Object namespaces with SQLite from.
   */
  new_sqlite_classes?: Array<string>;

  /**
   * Tag to set as the latest migration tag.
   */
  new_tag?: string;

  /**
   * Tag used to verify against the latest migration tag for this Worker. If they
   * don't match, the upload is rejected.
   */
  old_tag?: string;

  /**
   * A list of classes with Durable Object namespaces that were renamed.
   */
  renamed_classes?: Array<SingleStepMigrationParam.RenamedClass>;

  /**
   * A list of transfers for Durable Object namespaces from a different Worker and
   * class to a class defined in this Worker.
   */
  transferred_classes?: Array<SingleStepMigrationParam.TransferredClass>;
}

export namespace SingleStepMigrationParam {
  export interface RenamedClass {
    from?: string;

    to?: string;
  }

  export interface TransferredClass {
    from?: string;

    from_script?: string;

    to?: string;
  }
}

/**
 * JSON encoded metadata about the uploaded parts and Worker configuration.
 */
export interface WorkerMetadata {
  /**
   * Name of the part in the multipart request that contains the script (e.g. the
   * file adding a listener to the `fetch` event). Indicates a
   * `service worker syntax` Worker.
   */
  body_part?: string;

  /**
   * Name of the part in the multipart request that contains the main module (e.g.
   * the file exporting a `fetch` handler). Indicates a `module syntax` Worker.
   */
  main_module?: string;
}

/**
 * JSON encoded metadata about the uploaded parts and Worker configuration.
 */
export interface WorkerMetadataParam {
  /**
   * Name of the part in the multipart request that contains the script (e.g. the
   * file adding a listener to the `fetch` event). Indicates a
   * `service worker syntax` Worker.
   */
  body_part?: string;

  /**
   * Name of the part in the multipart request that contains the main module (e.g.
   * the file exporting a `fetch` handler). Indicates a `module syntax` Worker.
   */
  main_module?: string;
}

Workers.Routes = Routes;
Workers.RouteListResponsesSinglePage = RouteListResponsesSinglePage;
Workers.Assets = Assets;
Workers.Scripts = Scripts;
Workers.ScriptsSinglePage = ScriptsSinglePage;
Workers.AccountSettings = AccountSettings;
Workers.Domains = Domains;
Workers.DomainsSinglePage = DomainsSinglePage;
Workers.Subdomains = Subdomains;
Workers.Observability = Observability;

export declare namespace Workers {
  export {
    type MigrationStep as MigrationStep,
    type SingleStepMigration as SingleStepMigration,
    type WorkerMetadata as WorkerMetadata,
  };

  export {
    Routes as Routes,
    type RouteCreateResponse as RouteCreateResponse,
    type RouteUpdateResponse as RouteUpdateResponse,
    type RouteListResponse as RouteListResponse,
    type RouteDeleteResponse as RouteDeleteResponse,
    type RouteGetResponse as RouteGetResponse,
    RouteListResponsesSinglePage as RouteListResponsesSinglePage,
    type RouteCreateParams as RouteCreateParams,
    type RouteUpdateParams as RouteUpdateParams,
    type RouteListParams as RouteListParams,
    type RouteDeleteParams as RouteDeleteParams,
    type RouteGetParams as RouteGetParams,
  };

  export { Assets as Assets };

  export {
    Scripts as Scripts,
    type Script as Script,
    type ScriptSetting as ScriptSetting,
    type ScriptUpdateResponse as ScriptUpdateResponse,
    type ScriptDeleteResponse as ScriptDeleteResponse,
    type ScriptGetResponse as ScriptGetResponse,
    ScriptsSinglePage as ScriptsSinglePage,
    type ScriptUpdateParams as ScriptUpdateParams,
    type ScriptListParams as ScriptListParams,
    type ScriptDeleteParams as ScriptDeleteParams,
    type ScriptGetParams as ScriptGetParams,
  };

  export {
    AccountSettings as AccountSettings,
    type AccountSettingUpdateResponse as AccountSettingUpdateResponse,
    type AccountSettingGetResponse as AccountSettingGetResponse,
    type AccountSettingUpdateParams as AccountSettingUpdateParams,
    type AccountSettingGetParams as AccountSettingGetParams,
  };

  export {
    Domains as Domains,
    type Domain as Domain,
    DomainsSinglePage as DomainsSinglePage,
    type DomainUpdateParams as DomainUpdateParams,
    type DomainListParams as DomainListParams,
    type DomainDeleteParams as DomainDeleteParams,
    type DomainGetParams as DomainGetParams,
  };

  export {
    Subdomains as Subdomains,
    type SubdomainUpdateResponse as SubdomainUpdateResponse,
    type SubdomainGetResponse as SubdomainGetResponse,
    type SubdomainUpdateParams as SubdomainUpdateParams,
    type SubdomainGetParams as SubdomainGetParams,
  };

  export { Observability as Observability };
}
