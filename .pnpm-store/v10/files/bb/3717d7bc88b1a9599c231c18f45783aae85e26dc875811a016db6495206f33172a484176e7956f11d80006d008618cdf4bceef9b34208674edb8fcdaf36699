import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as LatestAPI from "./latest.js";
import { Latest, LatestListParams, LatestListResponse } from "./latest.js";
export declare class Events extends APIResource {
    latest: LatestAPI.Latest;
    /**
     * List Events
     *
     * @example
     * ```ts
     * const events =
     *   await client.magicTransit.connectors.events.list(
     *     'connector_id',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       from: 0,
     *       to: 0,
     *     },
     *   );
     * ```
     */
    list(connectorId: string, params: EventListParams, options?: Core.RequestOptions): Core.APIPromise<EventListResponse>;
    /**
     * Get Event
     *
     * @example
     * ```ts
     * const event =
     *   await client.magicTransit.connectors.events.get(
     *     'connector_id',
     *     0,
     *     0,
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(connectorId: string, eventT: number, eventN: number, params: EventGetParams, options?: Core.RequestOptions): Core.APIPromise<EventGetResponse>;
}
export interface EventListResponse {
    count: number;
    items: Array<EventListResponse.Item>;
    cursor?: string;
}
export declare namespace EventListResponse {
    interface Item {
        /**
         * Time the Event was collected (seconds since the Unix epoch)
         */
        a: number;
        /**
         * Kind
         */
        k: string;
        /**
         * Sequence number, used to order events with the same timestamp
         */
        n: number;
        /**
         * Time the Event was recorded (seconds since the Unix epoch)
         */
        t: number;
    }
}
/**
 * Recorded Event
 */
export interface EventGetResponse {
    e: EventGetResponse.Init | EventGetResponse.Leave | EventGetResponse.StartAttestation | EventGetResponse.FinishAttestationSuccess | EventGetResponse.FinishAttestationFailure | EventGetResponse.StartRotateCryptKey | EventGetResponse.FinishRotateCryptKeySuccess | EventGetResponse.FinishRotateCryptKeyFailure | EventGetResponse.StartRotatePki | EventGetResponse.FinishRotatePkiSuccess | EventGetResponse.FinishRotatePkiFailure | EventGetResponse.StartUpgrade | EventGetResponse.FinishUpgradeSuccess | EventGetResponse.FinishUpgradeFailure | EventGetResponse.Reconcile | EventGetResponse.ConfigureCloudflaredTunnel;
    /**
     * Sequence number, used to order events with the same timestamp
     */
    n: number;
    /**
     * Time the Event was recorded (seconds since the Unix epoch)
     */
    t: number;
}
export declare namespace EventGetResponse {
    interface Init {
        /**
         * Initialized process
         */
        k: 'Init';
    }
    interface Leave {
        /**
         * Stopped process
         */
        k: 'Leave';
    }
    interface StartAttestation {
        /**
         * Started attestation
         */
        k: 'StartAttestation';
    }
    interface FinishAttestationSuccess {
        /**
         * Finished attestation
         */
        k: 'FinishAttestationSuccess';
    }
    interface FinishAttestationFailure {
        /**
         * Failed attestation
         */
        k: 'FinishAttestationFailure';
    }
    interface StartRotateCryptKey {
        /**
         * Started crypt key rotation
         */
        k: 'StartRotateCryptKey';
    }
    interface FinishRotateCryptKeySuccess {
        /**
         * Finished crypt key rotation
         */
        k: 'FinishRotateCryptKeySuccess';
    }
    interface FinishRotateCryptKeyFailure {
        /**
         * Failed crypt key rotation
         */
        k: 'FinishRotateCryptKeyFailure';
    }
    interface StartRotatePki {
        /**
         * Started PKI rotation
         */
        k: 'StartRotatePki';
    }
    interface FinishRotatePkiSuccess {
        /**
         * Finished PKI rotation
         */
        k: 'FinishRotatePkiSuccess';
    }
    interface FinishRotatePkiFailure {
        /**
         * Failed PKI rotation
         */
        k: 'FinishRotatePkiFailure';
    }
    interface StartUpgrade {
        /**
         * Started upgrade
         */
        k: 'StartUpgrade';
        /**
         * Location of upgrade bundle
         */
        url: string;
    }
    interface FinishUpgradeSuccess {
        /**
         * Finished upgrade
         */
        k: 'FinishUpgradeSuccess';
    }
    interface FinishUpgradeFailure {
        /**
         * Failed upgrade
         */
        k: 'FinishUpgradeFailure';
    }
    interface Reconcile {
        /**
         * Reconciled
         */
        k: 'Reconcile';
    }
    interface ConfigureCloudflaredTunnel {
        /**
         * Configured Cloudflared tunnel
         */
        k: 'ConfigureCloudflaredTunnel';
    }
}
export interface EventListParams {
    /**
     * Path param: Account identifier
     */
    account_id: string;
    /**
     * Query param:
     */
    from: number;
    /**
     * Query param:
     */
    to: number;
    /**
     * Query param:
     */
    cursor?: string;
    /**
     * Query param:
     */
    limit?: number;
}
export interface EventGetParams {
    /**
     * Account identifier
     */
    account_id: string;
}
export declare namespace Events {
    export { type EventListResponse as EventListResponse, type EventGetResponse as EventGetResponse, type EventListParams as EventListParams, type EventGetParams as EventGetParams, };
    export { Latest as Latest, type LatestListResponse as LatestListResponse, type LatestListParams as LatestListParams, };
}
//# sourceMappingURL=events.d.ts.map