// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as SubmissionsAPI from './submissions';
import {
  SubmissionListParams,
  SubmissionListResponse,
  SubmissionListResponsesV4PagePaginationArray,
  Submissions,
} from './submissions';
import * as InvestigateAPI from './investigate/investigate';
import {
  Investigate,
  InvestigateGetParams,
  InvestigateGetResponse,
  InvestigateListParams,
  InvestigateListResponse,
  InvestigateListResponsesV4PagePaginationArray,
} from './investigate/investigate';
import * as SettingsAPI from './settings/settings';
import { Settings } from './settings/settings';

export class EmailSecurity extends APIResource {
  investigate: InvestigateAPI.Investigate = new InvestigateAPI.Investigate(this._client);
  settings: SettingsAPI.Settings = new SettingsAPI.Settings(this._client);
  submissions: SubmissionsAPI.Submissions = new SubmissionsAPI.Submissions(this._client);
}

EmailSecurity.Investigate = Investigate;
EmailSecurity.InvestigateListResponsesV4PagePaginationArray = InvestigateListResponsesV4PagePaginationArray;
EmailSecurity.Settings = Settings;
EmailSecurity.Submissions = Submissions;
EmailSecurity.SubmissionListResponsesV4PagePaginationArray = SubmissionListResponsesV4PagePaginationArray;

export declare namespace EmailSecurity {
  export {
    Investigate as Investigate,
    type InvestigateListResponse as InvestigateListResponse,
    type InvestigateGetResponse as InvestigateGetResponse,
    InvestigateListResponsesV4PagePaginationArray as InvestigateListResponsesV4PagePaginationArray,
    type InvestigateListParams as InvestigateListParams,
    type InvestigateGetParams as InvestigateGetParams,
  };

  export { Settings as Settings };

  export {
    Submissions as Submissions,
    type SubmissionListResponse as SubmissionListResponse,
    SubmissionListResponsesV4PagePaginationArray as SubmissionListResponsesV4PagePaginationArray,
    type SubmissionListParams as SubmissionListParams,
  };
}
