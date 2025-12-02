import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as ConfigAPI from "./config.js";
import { Config, ConfigGetParams, ConfigUpdateParams, Configuration } from "./config.js";
import * as DefaultAPI from "./default.js";
import { Default, DefaultGetParams } from "./default.js";
import * as ExportAPI from "./export.js";
import { Export, ExportGetParams } from "./export.js";
import * as PublishAPI from "./publish.js";
import { Publish, PublishCreateParams, PublishCreateResponse } from "./publish.js";
import * as WorkflowAPI from "./workflow.js";
import { Workflow, WorkflowGetParams, WorkflowResource } from "./workflow.js";
import * as HistoryAPI from "./history/history.js";
import { History, HistoryListParams, HistoryListResponse, HistoryListResponsesSinglePage, HistoryUpdateParams } from "./history/history.js";
export declare class Zaraz extends APIResource {
    config: ConfigAPI.Config;
    default: DefaultAPI.Default;
    export: ExportAPI.Export;
    history: HistoryAPI.History;
    publish: PublishAPI.Publish;
    workflow: WorkflowAPI.WorkflowResource;
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
    update(params: ZarazUpdateParams, options?: Core.RequestOptions): Core.APIPromise<WorkflowAPI.Workflow>;
}
export interface ButtonTextTranslation {
    /**
     * Object where keys are language codes
     */
    accept_all: {
        [key: string]: string;
    };
    /**
     * Object where keys are language codes
     */
    confirm_my_choices: {
        [key: string]: string;
    };
    /**
     * Object where keys are language codes
     */
    reject_all: {
        [key: string]: string;
    };
}
export interface ButtonTextTranslationParam {
    /**
     * Object where keys are language codes
     */
    accept_all: {
        [key: string]: string;
    };
    /**
     * Object where keys are language codes
     */
    confirm_my_choices: {
        [key: string]: string;
    };
    /**
     * Object where keys are language codes
     */
    reject_all: {
        [key: string]: string;
    };
}
export interface NeoEvent {
    /**
     * Tool event type
     */
    actionType: string;
    /**
     * List of blocking triggers IDs
     */
    blockingTriggers: Array<string>;
    /**
     * Event payload
     */
    data: unknown;
    /**
     * List of firing triggers IDs
     */
    firingTriggers: Array<string>;
}
export interface NeoEventParam {
    /**
     * Tool event type
     */
    actionType: string;
    /**
     * List of blocking triggers IDs
     */
    blockingTriggers: Array<string>;
    /**
     * Event payload
     */
    data: unknown;
    /**
     * List of firing triggers IDs
     */
    firingTriggers: Array<string>;
}
export interface ZarazUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: Zaraz workflow
     */
    workflow: WorkflowAPI.WorkflowParam;
}
export declare namespace Zaraz {
    export { type ButtonTextTranslation as ButtonTextTranslation, type NeoEvent as NeoEvent, type ZarazUpdateParams as ZarazUpdateParams, };
    export { Config as Config, type Configuration as Configuration, type ConfigUpdateParams as ConfigUpdateParams, type ConfigGetParams as ConfigGetParams, };
    export { Default as Default, type DefaultGetParams as DefaultGetParams };
    export { Export as Export, type ExportGetParams as ExportGetParams };
    export { History as History, type HistoryListResponse as HistoryListResponse, HistoryListResponsesSinglePage as HistoryListResponsesSinglePage, type HistoryUpdateParams as HistoryUpdateParams, type HistoryListParams as HistoryListParams, };
    export { Publish as Publish, type PublishCreateResponse as PublishCreateResponse, type PublishCreateParams as PublishCreateParams, };
    export { WorkflowResource as WorkflowResource, type Workflow as Workflow, type WorkflowGetParams as WorkflowGetParams, };
}
//# sourceMappingURL=zaraz.d.ts.map