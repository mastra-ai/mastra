// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class WorkflowResource extends APIResource {
  /**
   * Gets Zaraz workflow for a zone.
   *
   * @example
   * ```ts
   * const workflow = await client.zaraz.workflow.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: WorkflowGetParams, options?: Core.RequestOptions): Core.APIPromise<Workflow> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/settings/zaraz/workflow`, options) as Core.APIPromise<{
        result: Workflow;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Zaraz workflow
 */
export type Workflow = 'realtime' | 'preview';

/**
 * Zaraz workflow
 */
export type WorkflowParam = 'realtime' | 'preview';

export interface WorkflowGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace WorkflowResource {
  export { type Workflow as Workflow, type WorkflowGetParams as WorkflowGetParams };
}
