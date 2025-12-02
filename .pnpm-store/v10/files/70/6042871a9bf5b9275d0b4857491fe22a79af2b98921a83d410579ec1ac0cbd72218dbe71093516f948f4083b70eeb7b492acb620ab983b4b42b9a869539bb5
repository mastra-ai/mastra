// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as ConnectivityPrecheckAPI from './connectivity-precheck';
import {
  ConnectivityPrecheck,
  ConnectivityPrecheckSourceParams,
  ConnectivityPrecheckSourceResponse,
  ConnectivityPrecheckTargetParams,
  ConnectivityPrecheckTargetResponse,
} from './connectivity-precheck';
import * as JobsAPI from './jobs/jobs';
import {
  JobAbortAllParams,
  JobAbortAllResponse,
  JobAbortParams,
  JobAbortResponse,
  JobCreateParams,
  JobCreateResponse,
  JobGetParams,
  JobGetResponse,
  JobListParams,
  JobListResponse,
  JobListResponsesSinglePage,
  JobPauseParams,
  JobPauseResponse,
  JobProgressParams,
  JobProgressResponse,
  JobResumeParams,
  JobResumeResponse,
  Jobs,
} from './jobs/jobs';

export class SuperSlurper extends APIResource {
  jobs: JobsAPI.Jobs = new JobsAPI.Jobs(this._client);
  connectivityPrecheck: ConnectivityPrecheckAPI.ConnectivityPrecheck =
    new ConnectivityPrecheckAPI.ConnectivityPrecheck(this._client);
}

SuperSlurper.Jobs = Jobs;
SuperSlurper.JobListResponsesSinglePage = JobListResponsesSinglePage;
SuperSlurper.ConnectivityPrecheck = ConnectivityPrecheck;

export declare namespace SuperSlurper {
  export {
    Jobs as Jobs,
    type JobCreateResponse as JobCreateResponse,
    type JobListResponse as JobListResponse,
    type JobAbortResponse as JobAbortResponse,
    type JobAbortAllResponse as JobAbortAllResponse,
    type JobGetResponse as JobGetResponse,
    type JobPauseResponse as JobPauseResponse,
    type JobProgressResponse as JobProgressResponse,
    type JobResumeResponse as JobResumeResponse,
    JobListResponsesSinglePage as JobListResponsesSinglePage,
    type JobCreateParams as JobCreateParams,
    type JobListParams as JobListParams,
    type JobAbortParams as JobAbortParams,
    type JobAbortAllParams as JobAbortAllParams,
    type JobGetParams as JobGetParams,
    type JobPauseParams as JobPauseParams,
    type JobProgressParams as JobProgressParams,
    type JobResumeParams as JobResumeParams,
  };

  export {
    ConnectivityPrecheck as ConnectivityPrecheck,
    type ConnectivityPrecheckSourceResponse as ConnectivityPrecheckSourceResponse,
    type ConnectivityPrecheckTargetResponse as ConnectivityPrecheckTargetResponse,
    type ConnectivityPrecheckSourceParams as ConnectivityPrecheckSourceParams,
    type ConnectivityPrecheckTargetParams as ConnectivityPrecheckTargetParams,
  };
}
