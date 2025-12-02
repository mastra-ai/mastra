// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as ConfigAPI from "./config.mjs";
import { Config, ConfigListResponsesSinglePage, } from "./config.mjs";
import * as ResultsAPI from "./results.mjs";
import { Results } from "./results.mjs";
export class Scans extends APIResource {
    constructor() {
        super(...arguments);
        this.results = new ResultsAPI.Results(this._client);
        this.config = new ConfigAPI.Config(this._client);
    }
}
Scans.Results = Results;
Scans.Config = Config;
Scans.ConfigListResponsesSinglePage = ConfigListResponsesSinglePage;
//# sourceMappingURL=scans.mjs.map