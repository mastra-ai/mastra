// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as ConfigAPI from "./config.mjs";
import { Config } from "./config.mjs";
import * as DefaultAPI from "./default.mjs";
import { Default } from "./default.mjs";
import * as ExportAPI from "./export.mjs";
import { Export } from "./export.mjs";
import * as PublishAPI from "./publish.mjs";
import { Publish } from "./publish.mjs";
import * as WorkflowAPI from "./workflow.mjs";
import { WorkflowResource } from "./workflow.mjs";
import * as HistoryAPI from "./history/history.mjs";
import { History, HistoryListResponsesSinglePage, } from "./history/history.mjs";
export class Zaraz extends APIResource {
    constructor() {
        super(...arguments);
        this.config = new ConfigAPI.Config(this._client);
        this.default = new DefaultAPI.Default(this._client);
        this.export = new ExportAPI.Export(this._client);
        this.history = new HistoryAPI.History(this._client);
        this.publish = new PublishAPI.Publish(this._client);
        this.workflow = new WorkflowAPI.WorkflowResource(this._client);
    }
    /**
     * Updates Zaraz workflow for a zone.
     *
     * @example
     * ```ts
     * const workflow = await client.zaraz.update({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   workflow: 'realtime',
     * });
     * ```
     */
    update(params, options) {
        const { zone_id, workflow } = params;
        return this._client.put(`/zones/${zone_id}/settings/zaraz/workflow`, {
            body: workflow,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
Zaraz.Config = Config;
Zaraz.Default = Default;
Zaraz.Export = Export;
Zaraz.History = History;
Zaraz.HistoryListResponsesSinglePage = HistoryListResponsesSinglePage;
Zaraz.Publish = Publish;
Zaraz.WorkflowResource = WorkflowResource;
//# sourceMappingURL=zaraz.mjs.map