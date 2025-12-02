import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Behaviours extends APIResource {
    /**
     * Update configuration for risk behaviors
     *
     * @example
     * ```ts
     * const behaviour =
     *   await client.zeroTrust.riskScoring.behaviours.update({
     *     account_id: 'account_id',
     *     behaviors: {
     *       foo: { enabled: true, risk_level: 'low' },
     *     },
     *   });
     * ```
     */
    update(params: BehaviourUpdateParams, options?: Core.RequestOptions): Core.APIPromise<BehaviourUpdateResponse>;
    /**
     * Get all behaviors and associated configuration
     *
     * @example
     * ```ts
     * const behaviour =
     *   await client.zeroTrust.riskScoring.behaviours.get({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(params: BehaviourGetParams, options?: Core.RequestOptions): Core.APIPromise<BehaviourGetResponse>;
}
export interface BehaviourUpdateResponse {
    behaviors: {
        [key: string]: BehaviourUpdateResponse.Behaviors;
    };
}
export declare namespace BehaviourUpdateResponse {
    interface Behaviors {
        enabled: boolean;
        risk_level: 'low' | 'medium' | 'high';
    }
}
export interface BehaviourGetResponse {
    behaviors: {
        [key: string]: BehaviourGetResponse.Behaviors;
    };
}
export declare namespace BehaviourGetResponse {
    interface Behaviors {
        description: string;
        enabled: boolean;
        name: string;
        risk_level: 'low' | 'medium' | 'high';
    }
}
export interface BehaviourUpdateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    behaviors: {
        [key: string]: BehaviourUpdateParams.Behaviors;
    };
}
export declare namespace BehaviourUpdateParams {
    interface Behaviors {
        enabled: boolean;
        risk_level: 'low' | 'medium' | 'high';
    }
}
export interface BehaviourGetParams {
    account_id: string;
}
export declare namespace Behaviours {
    export { type BehaviourUpdateResponse as BehaviourUpdateResponse, type BehaviourGetResponse as BehaviourGetResponse, type BehaviourUpdateParams as BehaviourUpdateParams, type BehaviourGetParams as BehaviourGetParams, };
}
//# sourceMappingURL=behaviours.d.ts.map