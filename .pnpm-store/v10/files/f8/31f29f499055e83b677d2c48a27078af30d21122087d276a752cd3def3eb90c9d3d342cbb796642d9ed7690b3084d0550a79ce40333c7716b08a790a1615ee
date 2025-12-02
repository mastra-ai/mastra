// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as TimeseriesGroupsAPI from "./timeseries-groups.mjs";
import { TimeseriesGroups, } from "./timeseries-groups.mjs";
import * as ToMarkdownAPI from "./to-markdown.mjs";
import { ToMarkdown, ToMarkdownCreateResponsesSinglePage, } from "./to-markdown.mjs";
import * as BotsAPI from "./bots/bots.mjs";
import { Bots } from "./bots/bots.mjs";
import * as InferenceAPI from "./inference/inference.mjs";
import { Inference } from "./inference/inference.mjs";
export class AI extends APIResource {
    constructor() {
        super(...arguments);
        this.toMarkdown = new ToMarkdownAPI.ToMarkdown(this._client);
        this.inference = new InferenceAPI.Inference(this._client);
        this.bots = new BotsAPI.Bots(this._client);
        this.timeseriesGroups = new TimeseriesGroupsAPI.TimeseriesGroups(this._client);
    }
}
AI.ToMarkdown = ToMarkdown;
AI.ToMarkdownCreateResponsesSinglePage = ToMarkdownCreateResponsesSinglePage;
AI.Inference = Inference;
AI.Bots = Bots;
AI.TimeseriesGroups = TimeseriesGroups;
//# sourceMappingURL=ai.mjs.map