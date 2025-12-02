import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Latest extends APIResource {
    /**
     * Get latest Events
     *
     * @example
     * ```ts
     * const latests =
     *   await client.magicTransit.connectors.events.latest.list(
     *     'connector_id',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    list(connectorId: string, params: LatestListParams, options?: Core.RequestOptions): Core.APIPromise<LatestListResponse>;
}
export interface LatestListResponse {
    count: number;
    items: Array<LatestListResponse.Item>;
}
export declare namespace LatestListResponse {
    /**
     * Recorded Event
     */
    interface Item {
        e: Item.Init | Item.Leave | Item.StartAttestation | Item.FinishAttestationSuccess | Item.FinishAttestationFailure | Item.StartRotateCryptKey | Item.FinishRotateCryptKeySuccess | Item.FinishRotateCryptKeyFailure | Item.StartRotatePki | Item.FinishRotatePkiSuccess | Item.FinishRotatePkiFailure | Item.StartUpgrade | Item.FinishUpgradeSuccess | Item.FinishUpgradeFailure | Item.Reconcile | Item.ConfigureCloudflaredTunnel;
        /**
         * Sequence number, used to order events with the same timestamp
         */
        n: number;
        /**
         * Time the Event was recorded (seconds since the Unix epoch)
         */
        t: number;
    }
    namespace Item {
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
}
export interface LatestListParams {
    /**
     * Account identifier
     */
    account_id: string;
}
export declare namespace Latest {
    export { type LatestListResponse as LatestListResponse, type LatestListParams as LatestListParams };
}
//# sourceMappingURL=latest.d.ts.map