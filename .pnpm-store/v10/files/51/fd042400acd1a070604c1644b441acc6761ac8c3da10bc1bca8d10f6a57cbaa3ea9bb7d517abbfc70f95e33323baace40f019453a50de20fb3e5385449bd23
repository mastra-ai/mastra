// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as ScriptsAPI from './scripts';
import * as TailAPI from './tail';

export class Settings extends APIResource {
  /**
   * Patch script-level settings when using
   * [Worker Versions](https://developers.cloudflare.com/api/operations/worker-versions-list-versions).
   * Including but not limited to Logpush and Tail Consumers.
   *
   * @example
   * ```ts
   * const scriptSetting =
   *   await client.workers.scripts.settings.edit(
   *     'this-is_my_script-01',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  edit(
    scriptName: string,
    params: SettingEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ScriptsAPI.ScriptSetting> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/workers/scripts/${scriptName}/script-settings`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: ScriptsAPI.ScriptSetting }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get script-level settings when using
   * [Worker Versions](https://developers.cloudflare.com/api/operations/worker-versions-list-versions).
   * Includes Logpush and Tail Consumers.
   *
   * @example
   * ```ts
   * const scriptSetting =
   *   await client.workers.scripts.settings.get(
   *     'this-is_my_script-01',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    scriptName: string,
    params: SettingGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ScriptsAPI.ScriptSetting> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/workers/scripts/${scriptName}/script-settings`,
        options,
      ) as Core.APIPromise<{ result: ScriptsAPI.ScriptSetting }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface SettingEditParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: Whether Logpush is turned on for the Worker.
   */
  logpush?: boolean;

  /**
   * Body param: Observability settings for the Worker.
   */
  observability?: SettingEditParams.Observability | null;

  /**
   * Body param: List of Workers that will consume logs from the attached Worker.
   */
  tail_consumers?: Array<TailAPI.ConsumerScriptParam> | null;
}

export namespace SettingEditParams {
  /**
   * Observability settings for the Worker.
   */
  export interface Observability {
    /**
     * Whether observability is enabled for the Worker.
     */
    enabled: boolean;

    /**
     * The sampling rate for incoming requests. From 0 to 1 (1 = 100%, 0.1 = 10%).
     * Default is 1.
     */
    head_sampling_rate?: number | null;

    /**
     * Log settings for the Worker.
     */
    logs?: Observability.Logs | null;
  }

  export namespace Observability {
    /**
     * Log settings for the Worker.
     */
    export interface Logs {
      /**
       * Whether logs are enabled for the Worker.
       */
      enabled: boolean;

      /**
       * Whether
       * [invocation logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#invocation-logs)
       * are enabled for the Worker.
       */
      invocation_logs: boolean;

      /**
       * The sampling rate for logs. From 0 to 1 (1 = 100%, 0.1 = 10%). Default is 1.
       */
      head_sampling_rate?: number | null;
    }
  }
}

export interface SettingGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export declare namespace Settings {
  export { type SettingEditParams as SettingEditParams, type SettingGetParams as SettingGetParams };
}
