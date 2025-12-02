// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as ConnectivityPrecheckAPI from "./connectivity-precheck.mjs";
import { ConnectivityPrecheck, } from "./connectivity-precheck.mjs";
import * as JobsAPI from "./jobs/jobs.mjs";
import { JobListResponsesSinglePage, Jobs, } from "./jobs/jobs.mjs";
export class SuperSlurper extends APIResource {
    constructor() {
        super(...arguments);
        this.jobs = new JobsAPI.Jobs(this._client);
        this.connectivityPrecheck = new ConnectivityPrecheckAPI.ConnectivityPrecheck(this._client);
    }
}
SuperSlurper.Jobs = Jobs;
SuperSlurper.JobListResponsesSinglePage = JobListResponsesSinglePage;
SuperSlurper.ConnectivityPrecheck = ConnectivityPrecheck;
//# sourceMappingURL=super-slurper.mjs.map