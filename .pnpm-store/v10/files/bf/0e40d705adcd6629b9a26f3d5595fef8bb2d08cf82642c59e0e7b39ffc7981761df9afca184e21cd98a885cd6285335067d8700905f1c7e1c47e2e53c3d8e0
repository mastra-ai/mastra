// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as EdgeAPI from "./edge.mjs";
import { Edge, InstantLogpushJobsSinglePage, } from "./edge.mjs";
import * as JobsAPI from "./jobs.mjs";
import { Jobs, LogpushJobsSinglePage, } from "./jobs.mjs";
import * as OwnershipAPI from "./ownership.mjs";
import { Ownership, } from "./ownership.mjs";
import * as ValidateAPI from "./validate.mjs";
import { Validate, } from "./validate.mjs";
import * as DatasetsAPI from "./datasets/datasets.mjs";
import { Datasets } from "./datasets/datasets.mjs";
export class Logpush extends APIResource {
    constructor() {
        super(...arguments);
        this.datasets = new DatasetsAPI.Datasets(this._client);
        this.edge = new EdgeAPI.Edge(this._client);
        this.jobs = new JobsAPI.Jobs(this._client);
        this.ownership = new OwnershipAPI.Ownership(this._client);
        this.validate = new ValidateAPI.Validate(this._client);
    }
}
Logpush.Datasets = Datasets;
Logpush.Edge = Edge;
Logpush.InstantLogpushJobsSinglePage = InstantLogpushJobsSinglePage;
Logpush.Jobs = Jobs;
Logpush.LogpushJobsSinglePage = LogpushJobsSinglePage;
Logpush.Ownership = Ownership;
Logpush.Validate = Validate;
//# sourceMappingURL=logpush.mjs.map