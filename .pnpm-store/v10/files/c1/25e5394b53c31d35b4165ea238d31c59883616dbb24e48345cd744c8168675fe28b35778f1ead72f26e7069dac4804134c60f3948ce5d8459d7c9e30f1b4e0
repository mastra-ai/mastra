// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class FleetStatus extends APIResource {
  /**
   * Get the live status of a latest device given device_id from the device_state
   * table
   *
   * @example
   * ```ts
   * const fleetStatus =
   *   await client.zeroTrust.devices.fleetStatus.get(
   *     'cb49c27f-7f97-49c5-b6f3-f7c01ead0fd7',
   *     {
   *       account_id: '01a7362d577a6c3019a474fd6f485823',
   *       since_minutes: 10,
   *     },
   *   );
   * ```
   */
  get(
    deviceId: string,
    params: FleetStatusGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FleetStatusGetResponse> {
    const { account_id, ...query } = params;
    return this._client.get(`/accounts/${account_id}/dex/devices/${deviceId}/fleet-status/live`, {
      query,
      ...options,
    });
  }
}

export interface FleetStatusGetResponse {
  /**
   * Cloudflare colo
   */
  colo: string;

  /**
   * Device identifier (UUID v4)
   */
  deviceId: string;

  /**
   * The mode under which the WARP client is run
   */
  mode: string;

  /**
   * Operating system
   */
  platform: string;

  /**
   * Network status
   */
  status: string;

  /**
   * Timestamp in ISO format
   */
  timestamp: string;

  /**
   * WARP client version
   */
  version: string;

  alwaysOn?: boolean | null;

  batteryCharging?: boolean | null;

  batteryCycles?: number | null;

  batteryPct?: number | null;

  connectionType?: string | null;

  cpuPct?: number | null;

  cpuPctByApp?: Array<Array<FleetStatusGetResponse.CPUPctByApp>> | null;

  deviceIpv4?: FleetStatusGetResponse.DeviceIPV4;

  deviceIpv6?: FleetStatusGetResponse.DeviceIPV6;

  /**
   * Device identifier (human readable)
   */
  deviceName?: string;

  diskReadBps?: number | null;

  diskUsagePct?: number | null;

  diskWriteBps?: number | null;

  dohSubdomain?: string | null;

  estimatedLossPct?: number | null;

  firewallEnabled?: boolean | null;

  gatewayIpv4?: FleetStatusGetResponse.GatewayIPV4;

  gatewayIpv6?: FleetStatusGetResponse.GatewayIPV6;

  handshakeLatencyMs?: number | null;

  ispIpv4?: FleetStatusGetResponse.ISPIPV4;

  ispIpv6?: FleetStatusGetResponse.ISPIPV6;

  metal?: string | null;

  networkRcvdBps?: number | null;

  networkSentBps?: number | null;

  networkSsid?: string | null;

  /**
   * User contact email address
   */
  personEmail?: string;

  ramAvailableKb?: number | null;

  ramUsedPct?: number | null;

  ramUsedPctByApp?: Array<Array<FleetStatusGetResponse.RamUsedPctByApp>> | null;

  switchLocked?: boolean | null;

  wifiStrengthDbm?: number | null;
}

export namespace FleetStatusGetResponse {
  export interface CPUPctByApp {
    cpu_pct?: number;

    name?: string;
  }

  export interface DeviceIPV4 {
    address?: string | null;

    asn?: number | null;

    aso?: string | null;

    location?: DeviceIPV4.Location;

    netmask?: string | null;

    version?: string | null;
  }

  export namespace DeviceIPV4 {
    export interface Location {
      city?: string | null;

      country_iso?: string | null;

      state_iso?: string | null;

      zip?: string | null;
    }
  }

  export interface DeviceIPV6 {
    address?: string | null;

    asn?: number | null;

    aso?: string | null;

    location?: DeviceIPV6.Location;

    netmask?: string | null;

    version?: string | null;
  }

  export namespace DeviceIPV6 {
    export interface Location {
      city?: string | null;

      country_iso?: string | null;

      state_iso?: string | null;

      zip?: string | null;
    }
  }

  export interface GatewayIPV4 {
    address?: string | null;

    asn?: number | null;

    aso?: string | null;

    location?: GatewayIPV4.Location;

    netmask?: string | null;

    version?: string | null;
  }

  export namespace GatewayIPV4 {
    export interface Location {
      city?: string | null;

      country_iso?: string | null;

      state_iso?: string | null;

      zip?: string | null;
    }
  }

  export interface GatewayIPV6 {
    address?: string | null;

    asn?: number | null;

    aso?: string | null;

    location?: GatewayIPV6.Location;

    netmask?: string | null;

    version?: string | null;
  }

  export namespace GatewayIPV6 {
    export interface Location {
      city?: string | null;

      country_iso?: string | null;

      state_iso?: string | null;

      zip?: string | null;
    }
  }

  export interface ISPIPV4 {
    address?: string | null;

    asn?: number | null;

    aso?: string | null;

    location?: ISPIPV4.Location;

    netmask?: string | null;

    version?: string | null;
  }

  export namespace ISPIPV4 {
    export interface Location {
      city?: string | null;

      country_iso?: string | null;

      state_iso?: string | null;

      zip?: string | null;
    }
  }

  export interface ISPIPV6 {
    address?: string | null;

    asn?: number | null;

    aso?: string | null;

    location?: ISPIPV6.Location;

    netmask?: string | null;

    version?: string | null;
  }

  export namespace ISPIPV6 {
    export interface Location {
      city?: string | null;

      country_iso?: string | null;

      state_iso?: string | null;

      zip?: string | null;
    }
  }

  export interface RamUsedPctByApp {
    name?: string;

    ram_used_pct?: number;
  }
}

export interface FleetStatusGetParams {
  /**
   * Path param: Unique identifier for account
   */
  account_id: string;

  /**
   * Query param: Number of minutes before current time
   */
  since_minutes: number;

  /**
   * Query param: List of data centers to filter results
   */
  colo?: string;

  /**
   * Query param: Number of minutes before current time
   */
  time_now?: string;
}

export declare namespace FleetStatus {
  export {
    type FleetStatusGetResponse as FleetStatusGetResponse,
    type FleetStatusGetParams as FleetStatusGetParams,
  };
}
