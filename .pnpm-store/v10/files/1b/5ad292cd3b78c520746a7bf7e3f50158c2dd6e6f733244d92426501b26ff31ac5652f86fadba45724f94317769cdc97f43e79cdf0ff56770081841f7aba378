// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';

export class Logs extends APIResource {
  /**
   * Fetch deployment logs for a project.
   *
   * @example
   * ```ts
   * const log =
   *   await client.pages.projects.deployments.history.logs.get(
   *     'this-is-my-project-01',
   *     '023e105f4ecef8ad9ca31a8372d0c353',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    projectName: string,
    deploymentId: string,
    params: LogGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LogGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/pages/projects/${projectName}/deployments/${deploymentId}/history/logs`,
        options,
      ) as Core.APIPromise<{ result: LogGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface LogGetResponse {
  data?: Array<LogGetResponse.Data>;

  includes_container_logs?: boolean;

  total?: number;
}

export namespace LogGetResponse {
  export interface Data {
    line?: string;

    ts?: string;
  }
}

export interface LogGetParams {
  /**
   * Identifier
   */
  account_id: string;
}

export declare namespace Logs {
  export { type LogGetResponse as LogGetResponse, type LogGetParams as LogGetParams };
}
