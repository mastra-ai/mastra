// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as SubmissionsAPI from "./submissions.mjs";
import { SubmissionListResponsesV4PagePaginationArray, Submissions, } from "./submissions.mjs";
import * as InvestigateAPI from "./investigate/investigate.mjs";
import { Investigate, InvestigateListResponsesV4PagePaginationArray, } from "./investigate/investigate.mjs";
import * as SettingsAPI from "./settings/settings.mjs";
import { Settings } from "./settings/settings.mjs";
export class EmailSecurity extends APIResource {
    constructor() {
        super(...arguments);
        this.investigate = new InvestigateAPI.Investigate(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
        this.submissions = new SubmissionsAPI.Submissions(this._client);
    }
}
EmailSecurity.Investigate = Investigate;
EmailSecurity.InvestigateListResponsesV4PagePaginationArray = InvestigateListResponsesV4PagePaginationArray;
EmailSecurity.Settings = Settings;
EmailSecurity.Submissions = Submissions;
EmailSecurity.SubmissionListResponsesV4PagePaginationArray = SubmissionListResponsesV4PagePaginationArray;
//# sourceMappingURL=email-security.mjs.map