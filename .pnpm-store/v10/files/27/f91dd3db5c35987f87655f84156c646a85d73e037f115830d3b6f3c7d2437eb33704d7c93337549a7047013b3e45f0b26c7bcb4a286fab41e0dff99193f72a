// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as LatestAPI from './latest';
import { Latest, LatestListParams, LatestListResponse } from './latest';

export class Events extends APIResource {
  latest: LatestAPI.Latest = new LatestAPI.Latest(this._client);

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
  list(
    connectorId: string,
    params: EventListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EventListResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/magic/connectors/${connectorId}/telemetry/events`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: EventListResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

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
  get(
    connectorId: string,
    eventT: number,
    eventN: number,
    params: EventGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EventGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/magic/connectors/${connectorId}/telemetry/events/${eventT}.${eventN}`,
        options,
      ) as Core.APIPromise<{ result: EventGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface EventListResponse {
  count: number;

  items: Array<EventListResponse.Item>;

  cursor?: string;
}

export namespace EventListResponse {
  export interface Item {
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
  e:
    | EventGetResponse.Init
    | EventGetResponse.Leave
    | EventGetResponse.StartAttestation
    | EventGetResponse.FinishAttestationSuccess
    | EventGetResponse.FinishAttestationFailure
    | EventGetResponse.StartRotateCryptKey
    | EventGetResponse.FinishRotateCryptKeySuccess
    | EventGetResponse.FinishRotateCryptKeyFailure
    | EventGetResponse.StartRotatePki
    | EventGetResponse.FinishRotatePkiSuccess
    | EventGetResponse.FinishRotatePkiFailure
    | EventGetResponse.StartUpgrade
    | EventGetResponse.FinishUpgradeSuccess
    | EventGetResponse.FinishUpgradeFailure
    | EventGetResponse.Reconcile
    | EventGetResponse.ConfigureCloudflaredTunnel;

  /**
   * Sequence number, used to order events with the same timestamp
   */
  n: number;

  /**
   * Time the Event was recorded (seconds since the Unix epoch)
   */
  t: number;
}

export namespace EventGetResponse {
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

Events.Latest = Latest;

export declare namespace Events {
  export {
    type EventListResponse as EventListResponse,
    type EventGetResponse as EventGetResponse,
    type EventListParams as EventListParams,
    type EventGetParams as EventGetParams,
  };

  export {
    Latest as Latest,
    type LatestListResponse as LatestListResponse,
    type LatestListParams as LatestListParams,
  };
}
