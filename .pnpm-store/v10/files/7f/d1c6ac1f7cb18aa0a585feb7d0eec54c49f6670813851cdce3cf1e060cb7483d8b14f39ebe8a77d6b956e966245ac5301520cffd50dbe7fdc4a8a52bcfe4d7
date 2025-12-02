// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as HistoryAPI from './history';
import { BillingHistoriesV4PagePaginationArray, BillingHistory, History, HistoryListParams } from './history';
import * as ProfileAPI from './profile';
import { Profile, ProfileGetResponse } from './profile';

export class Billing extends APIResource {
  history: HistoryAPI.History = new HistoryAPI.History(this._client);
  profile: ProfileAPI.Profile = new ProfileAPI.Profile(this._client);
}

Billing.History = History;
Billing.BillingHistoriesV4PagePaginationArray = BillingHistoriesV4PagePaginationArray;
Billing.Profile = Profile;

export declare namespace Billing {
  export {
    History as History,
    type BillingHistory as BillingHistory,
    BillingHistoriesV4PagePaginationArray as BillingHistoriesV4PagePaginationArray,
    type HistoryListParams as HistoryListParams,
  };

  export { Profile as Profile, type ProfileGetResponse as ProfileGetResponse };
}
