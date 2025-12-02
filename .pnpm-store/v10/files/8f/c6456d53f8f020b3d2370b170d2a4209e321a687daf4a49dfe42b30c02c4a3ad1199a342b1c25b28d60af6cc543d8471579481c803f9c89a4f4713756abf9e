// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';

export class Latest extends APIResource {
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
  list(
    connectorId: string,
    params: LatestListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LatestListResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/magic/connectors/${connectorId}/telemetry/events/latest`,
        options,
      ) as Core.APIPromise<{ result: LatestListResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface LatestListResponse {
  count: number;

  items: Array<LatestListResponse.Item>;
}

export namespace LatestListResponse {
  /**
   * Recorded Event
   */
  export interface Item {
    e:
      | Item.Init
      | Item.Leave
      | Item.StartAttestation
      | Item.FinishAttestationSuccess
      | Item.FinishAttestationFailure
      | Item.StartRotateCryptKey
      | Item.FinishRotateCryptKeySuccess
      | Item.FinishRotateCryptKeyFailure
      | Item.StartRotatePki
      | Item.FinishRotatePkiSuccess
      | Item.FinishRotatePkiFailure
      | Item.StartUpgrade
      | Item.FinishUpgradeSuccess
      | Item.FinishUpgradeFailure
      | Item.Reconcile
      | Item.ConfigureCloudflaredTunnel;

    /**
     * Sequence number, used to order events with the same timestamp
     */
    n: number;

    /**
     * Time the Event was recorded (seconds since the Unix epoch)
     */
    t: number;
  }

  export namespace Item {
    export interface Init {
      /**
       * Initialized process
       */
      k: 'Init';
    }

    export interface Leave {
      /**
       * Stopped process
       */
      k: 'Leave';
    }

    export interface StartAttestation {
      /**
       * Started attestation
       */
      k: 'StartAttestation';
    }

    export interface FinishAttestationSuccess {
      /**
       * Finished attestation
       */
      k: 'FinishAttestationSuccess';
    }

    export interface FinishAttestationFailure {
      /**
       * Failed attestation
       */
      k: 'FinishAttestationFailure';
    }

    export interface StartRotateCryptKey {
      /**
       * Started crypt key rotation
       */
      k: 'StartRotateCryptKey';
    }

    export interface FinishRotateCryptKeySuccess {
      /**
       * Finished crypt key rotation
       */
      k: 'FinishRotateCryptKeySuccess';
    }

    export interface FinishRotateCryptKeyFailure {
      /**
       * Failed crypt key rotation
       */
      k: 'FinishRotateCryptKeyFailure';
    }

    export interface StartRotatePki {
      /**
       * Started PKI rotation
       */
      k: 'StartRotatePki';
    }

    export interface FinishRotatePkiSuccess {
      /**
       * Finished PKI rotation
       */
      k: 'FinishRotatePkiSuccess';
    }

    export interface FinishRotatePkiFailure {
      /**
       * Failed PKI rotation
       */
      k: 'FinishRotatePkiFailure';
    }

    export interface StartUpgrade {
      /**
       * Started upgrade
       */
      k: 'StartUpgrade';

      /**
       * Location of upgrade bundle
       */
      url: string;
    }

    export interface FinishUpgradeSuccess {
      /**
       * Finished upgrade
       */
      k: 'FinishUpgradeSuccess';
    }

    export interface FinishUpgradeFailure {
      /**
       * Failed upgrade
       */
      k: 'FinishUpgradeFailure';
    }

    export interface Reconcile {
      /**
       * Reconciled
       */
      k: 'Reconcile';
    }

    export interface ConfigureCloudflaredTunnel {
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
