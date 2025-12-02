// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as LimitsAPI from './limits';
import { LimitListParams, LimitListResponse, Limits } from './limits';
import * as PatternsAPI from './patterns';
import { PatternValidateParams, PatternValidateResponse, Patterns } from './patterns';
import * as PayloadLogsAPI from './payload-logs';
import {
  PayloadLogGetParams,
  PayloadLogGetResponse,
  PayloadLogUpdateParams,
  PayloadLogUpdateResponse,
  PayloadLogs,
} from './payload-logs';
import * as DatasetsAPI from './datasets/datasets';
import {
  Dataset,
  DatasetArray,
  DatasetCreateParams,
  DatasetCreation,
  DatasetDeleteParams,
  DatasetGetParams,
  DatasetListParams,
  DatasetUpdateParams,
  Datasets,
  DatasetsSinglePage,
} from './datasets/datasets';
import * as EmailAPI from './email/email';
import { Email } from './email/email';
import * as EntriesAPI from './entries/entries';
import {
  Entries,
  EntryCreateParams,
  EntryCreateResponse,
  EntryDeleteParams,
  EntryDeleteResponse,
  EntryGetParams,
  EntryGetResponse,
  EntryListParams,
  EntryListResponse,
  EntryListResponsesSinglePage,
  EntryUpdateParams,
  EntryUpdateResponse,
} from './entries/entries';
import * as ProfilesAPI from './profiles/profiles';
import {
  ContextAwareness,
  Profile,
  ProfileGetParams,
  ProfileListParams,
  Profiles,
  ProfilesSinglePage,
  SkipConfiguration,
} from './profiles/profiles';

export class DLP extends APIResource {
  datasets: DatasetsAPI.Datasets = new DatasetsAPI.Datasets(this._client);
  patterns: PatternsAPI.Patterns = new PatternsAPI.Patterns(this._client);
  payloadLogs: PayloadLogsAPI.PayloadLogs = new PayloadLogsAPI.PayloadLogs(this._client);
  email: EmailAPI.Email = new EmailAPI.Email(this._client);
  profiles: ProfilesAPI.Profiles = new ProfilesAPI.Profiles(this._client);
  limits: LimitsAPI.Limits = new LimitsAPI.Limits(this._client);
  entries: EntriesAPI.Entries = new EntriesAPI.Entries(this._client);
}

DLP.Datasets = Datasets;
DLP.DatasetsSinglePage = DatasetsSinglePage;
DLP.Patterns = Patterns;
DLP.PayloadLogs = PayloadLogs;
DLP.Email = Email;
DLP.Profiles = Profiles;
DLP.ProfilesSinglePage = ProfilesSinglePage;
DLP.Limits = Limits;
DLP.Entries = Entries;
DLP.EntryListResponsesSinglePage = EntryListResponsesSinglePage;

export declare namespace DLP {
  export {
    Datasets as Datasets,
    type Dataset as Dataset,
    type DatasetArray as DatasetArray,
    type DatasetCreation as DatasetCreation,
    DatasetsSinglePage as DatasetsSinglePage,
    type DatasetCreateParams as DatasetCreateParams,
    type DatasetUpdateParams as DatasetUpdateParams,
    type DatasetListParams as DatasetListParams,
    type DatasetDeleteParams as DatasetDeleteParams,
    type DatasetGetParams as DatasetGetParams,
  };

  export {
    Patterns as Patterns,
    type PatternValidateResponse as PatternValidateResponse,
    type PatternValidateParams as PatternValidateParams,
  };

  export {
    PayloadLogs as PayloadLogs,
    type PayloadLogUpdateResponse as PayloadLogUpdateResponse,
    type PayloadLogGetResponse as PayloadLogGetResponse,
    type PayloadLogUpdateParams as PayloadLogUpdateParams,
    type PayloadLogGetParams as PayloadLogGetParams,
  };

  export { Email as Email };

  export {
    Profiles as Profiles,
    type ContextAwareness as ContextAwareness,
    type Profile as Profile,
    type SkipConfiguration as SkipConfiguration,
    ProfilesSinglePage as ProfilesSinglePage,
    type ProfileListParams as ProfileListParams,
    type ProfileGetParams as ProfileGetParams,
  };

  export {
    Limits as Limits,
    type LimitListResponse as LimitListResponse,
    type LimitListParams as LimitListParams,
  };

  export {
    Entries as Entries,
    type EntryCreateResponse as EntryCreateResponse,
    type EntryUpdateResponse as EntryUpdateResponse,
    type EntryListResponse as EntryListResponse,
    type EntryDeleteResponse as EntryDeleteResponse,
    type EntryGetResponse as EntryGetResponse,
    EntryListResponsesSinglePage as EntryListResponsesSinglePage,
    type EntryCreateParams as EntryCreateParams,
    type EntryUpdateParams as EntryUpdateParams,
    type EntryListParams as EntryListParams,
    type EntryDeleteParams as EntryDeleteParams,
    type EntryGetParams as EntryGetParams,
  };
}
