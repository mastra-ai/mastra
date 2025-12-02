// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as ConfigAPI from './config';
import { Config, ConfigGetParams, ConfigUpdateParams, Configuration } from './config';
import * as DefaultAPI from './default';
import { Default, DefaultGetParams } from './default';
import * as ExportAPI from './export';
import { Export, ExportGetParams } from './export';
import * as PublishAPI from './publish';
import { Publish, PublishCreateParams, PublishCreateResponse } from './publish';
import * as WorkflowAPI from './workflow';
import { Workflow, WorkflowGetParams, WorkflowResource } from './workflow';
import * as HistoryAPI from './history/history';
import {
  History,
  HistoryListParams,
  HistoryListResponse,
  HistoryListResponsesSinglePage,
  HistoryUpdateParams,
} from './history/history';

export class Zaraz extends APIResource {
  config: ConfigAPI.Config = new ConfigAPI.Config(this._client);
  default: DefaultAPI.Default = new DefaultAPI.Default(this._client);
  export: ExportAPI.Export = new ExportAPI.Export(this._client);
  history: HistoryAPI.History = new HistoryAPI.History(this._client);
  publish: PublishAPI.Publish = new PublishAPI.Publish(this._client);
  workflow: WorkflowAPI.WorkflowResource = new WorkflowAPI.WorkflowResource(this._client);

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
  update(params: ZarazUpdateParams, options?: Core.RequestOptions): Core.APIPromise<WorkflowAPI.Workflow> {
    const { zone_id, workflow } = params;
    return (
      this._client.put(`/zones/${zone_id}/settings/zaraz/workflow`, {
        body: workflow,
        ...options,
      }) as Core.APIPromise<{ result: WorkflowAPI.Workflow }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ButtonTextTranslation {
  /**
   * Object where keys are language codes
   */
  accept_all: { [key: string]: string };

  /**
   * Object where keys are language codes
   */
  confirm_my_choices: { [key: string]: string };

  /**
   * Object where keys are language codes
   */
  reject_all: { [key: string]: string };
}

export interface ButtonTextTranslationParam {
  /**
   * Object where keys are language codes
   */
  accept_all: { [key: string]: string };

  /**
   * Object where keys are language codes
   */
  confirm_my_choices: { [key: string]: string };

  /**
   * Object where keys are language codes
   */
  reject_all: { [key: string]: string };
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

Zaraz.Config = Config;
Zaraz.Default = Default;
Zaraz.Export = Export;
Zaraz.History = History;
Zaraz.HistoryListResponsesSinglePage = HistoryListResponsesSinglePage;
Zaraz.Publish = Publish;
Zaraz.WorkflowResource = WorkflowResource;

export declare namespace Zaraz {
  export {
    type ButtonTextTranslation as ButtonTextTranslation,
    type NeoEvent as NeoEvent,
    type ZarazUpdateParams as ZarazUpdateParams,
  };

  export {
    Config as Config,
    type Configuration as Configuration,
    type ConfigUpdateParams as ConfigUpdateParams,
    type ConfigGetParams as ConfigGetParams,
  };

  export { Default as Default, type DefaultGetParams as DefaultGetParams };

  export { Export as Export, type ExportGetParams as ExportGetParams };

  export {
    History as History,
    type HistoryListResponse as HistoryListResponse,
    HistoryListResponsesSinglePage as HistoryListResponsesSinglePage,
    type HistoryUpdateParams as HistoryUpdateParams,
    type HistoryListParams as HistoryListParams,
  };

  export {
    Publish as Publish,
    type PublishCreateResponse as PublishCreateResponse,
    type PublishCreateParams as PublishCreateParams,
  };

  export {
    WorkflowResource as WorkflowResource,
    type Workflow as Workflow,
    type WorkflowGetParams as WorkflowGetParams,
  };
}
