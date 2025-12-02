// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as LimitsAPI from "./limits.mjs";
import { Limits } from "./limits.mjs";
import * as PatternsAPI from "./patterns.mjs";
import { Patterns } from "./patterns.mjs";
import * as PayloadLogsAPI from "./payload-logs.mjs";
import { PayloadLogs, } from "./payload-logs.mjs";
import * as DatasetsAPI from "./datasets/datasets.mjs";
import { Datasets, DatasetsSinglePage, } from "./datasets/datasets.mjs";
import * as EmailAPI from "./email/email.mjs";
import { Email } from "./email/email.mjs";
import * as EntriesAPI from "./entries/entries.mjs";
import { Entries, EntryListResponsesSinglePage, } from "./entries/entries.mjs";
import * as ProfilesAPI from "./profiles/profiles.mjs";
import { Profiles, ProfilesSinglePage, } from "./profiles/profiles.mjs";
export class DLP extends APIResource {
    constructor() {
        super(...arguments);
        this.datasets = new DatasetsAPI.Datasets(this._client);
        this.patterns = new PatternsAPI.Patterns(this._client);
        this.payloadLogs = new PayloadLogsAPI.PayloadLogs(this._client);
        this.email = new EmailAPI.Email(this._client);
        this.profiles = new ProfilesAPI.Profiles(this._client);
        this.limits = new LimitsAPI.Limits(this._client);
        this.entries = new EntriesAPI.Entries(this._client);
    }
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
//# sourceMappingURL=dlp.mjs.map