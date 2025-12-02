// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as EdgeAPI from './edge';
import {
  Edge,
  EdgeCreateParams,
  EdgeGetParams,
  InstantLogpushJob,
  InstantLogpushJobsSinglePage,
} from './edge';
import * as JobsAPI from './jobs';
import {
  JobCreateParams,
  JobDeleteParams,
  JobDeleteResponse,
  JobGetParams,
  JobListParams,
  JobUpdateParams,
  Jobs,
  LogpushJob,
  LogpushJobsSinglePage,
  OutputOptions,
} from './jobs';
import * as OwnershipAPI from './ownership';
import {
  Ownership,
  OwnershipCreateParams,
  OwnershipCreateResponse,
  OwnershipValidateParams,
  OwnershipValidation,
} from './ownership';
import * as ValidateAPI from './validate';
import {
  Validate,
  ValidateDestinationExistsParams,
  ValidateDestinationExistsResponse,
  ValidateDestinationParams,
  ValidateDestinationResponse,
  ValidateOriginParams,
  ValidateOriginResponse,
} from './validate';
import * as DatasetsAPI from './datasets/datasets';
import { Datasets } from './datasets/datasets';

export class Logpush extends APIResource {
  datasets: DatasetsAPI.Datasets = new DatasetsAPI.Datasets(this._client);
  edge: EdgeAPI.Edge = new EdgeAPI.Edge(this._client);
  jobs: JobsAPI.Jobs = new JobsAPI.Jobs(this._client);
  ownership: OwnershipAPI.Ownership = new OwnershipAPI.Ownership(this._client);
  validate: ValidateAPI.Validate = new ValidateAPI.Validate(this._client);
}

Logpush.Datasets = Datasets;
Logpush.Edge = Edge;
Logpush.InstantLogpushJobsSinglePage = InstantLogpushJobsSinglePage;
Logpush.Jobs = Jobs;
Logpush.LogpushJobsSinglePage = LogpushJobsSinglePage;
Logpush.Ownership = Ownership;
Logpush.Validate = Validate;

export declare namespace Logpush {
  export { Datasets as Datasets };

  export {
    Edge as Edge,
    type InstantLogpushJob as InstantLogpushJob,
    InstantLogpushJobsSinglePage as InstantLogpushJobsSinglePage,
    type EdgeCreateParams as EdgeCreateParams,
    type EdgeGetParams as EdgeGetParams,
  };

  export {
    Jobs as Jobs,
    type LogpushJob as LogpushJob,
    type OutputOptions as OutputOptions,
    type JobDeleteResponse as JobDeleteResponse,
    LogpushJobsSinglePage as LogpushJobsSinglePage,
    type JobCreateParams as JobCreateParams,
    type JobUpdateParams as JobUpdateParams,
    type JobListParams as JobListParams,
    type JobDeleteParams as JobDeleteParams,
    type JobGetParams as JobGetParams,
  };

  export {
    Ownership as Ownership,
    type OwnershipValidation as OwnershipValidation,
    type OwnershipCreateResponse as OwnershipCreateResponse,
    type OwnershipCreateParams as OwnershipCreateParams,
    type OwnershipValidateParams as OwnershipValidateParams,
  };

  export {
    Validate as Validate,
    type ValidateDestinationResponse as ValidateDestinationResponse,
    type ValidateDestinationExistsResponse as ValidateDestinationExistsResponse,
    type ValidateOriginResponse as ValidateOriginResponse,
    type ValidateDestinationParams as ValidateDestinationParams,
    type ValidateDestinationExistsParams as ValidateDestinationExistsParams,
    type ValidateOriginParams as ValidateOriginParams,
  };
}
