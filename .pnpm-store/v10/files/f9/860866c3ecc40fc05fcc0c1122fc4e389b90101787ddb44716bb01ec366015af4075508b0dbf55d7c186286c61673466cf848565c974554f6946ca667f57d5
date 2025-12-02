import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Schedules extends APIResource {
    /**
     * Updates Cron Triggers for a Worker.
     *
     * @example
     * ```ts
     * const schedule =
     *   await client.workers.scripts.schedules.update(
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       body: [{ cron: '* /30 * * * *' }],
     *     },
     *   );
     * ```
     */
    update(scriptName: string, params: ScheduleUpdateParams, options?: Core.RequestOptions): Core.APIPromise<ScheduleUpdateResponse>;
    /**
     * Fetches Cron Triggers for a Worker.
     *
     * @example
     * ```ts
     * const schedule = await client.workers.scripts.schedules.get(
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(scriptName: string, params: ScheduleGetParams, options?: Core.RequestOptions): Core.APIPromise<ScheduleGetResponse>;
}
export interface ScheduleUpdateResponse {
    schedules: Array<ScheduleUpdateResponse.Schedule>;
}
export declare namespace ScheduleUpdateResponse {
    interface Schedule {
        cron: string;
        created_on?: string;
        modified_on?: string;
    }
}
export interface ScheduleGetResponse {
    schedules: Array<ScheduleGetResponse.Schedule>;
}
export declare namespace ScheduleGetResponse {
    interface Schedule {
        cron: string;
        created_on?: string;
        modified_on?: string;
    }
}
export interface ScheduleUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    body: Array<ScheduleUpdateParams.Body>;
}
export declare namespace ScheduleUpdateParams {
    interface Body {
        cron: string;
    }
}
export interface ScheduleGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Schedules {
    export { type ScheduleUpdateResponse as ScheduleUpdateResponse, type ScheduleGetResponse as ScheduleGetResponse, type ScheduleUpdateParams as ScheduleUpdateParams, type ScheduleGetParams as ScheduleGetParams, };
}
//# sourceMappingURL=schedules.d.ts.map