// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../../pagination';

export class Devices extends APIResource {
  /**
   * List details for devices using WARP
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const deviceListResponse of client.zeroTrust.dex.fleetStatus.devices.list(
   *   {
   *     account_id: '01a7362d577a6c3019a474fd6f485823',
   *     from: '2023-10-11T00:00:00Z',
   *     page: 1,
   *     per_page: 10,
   *     to: '2023-10-11T00:00:00Z',
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: DeviceListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<DeviceListResponsesV4PagePaginationArray, DeviceListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/dex/fleet-status/devices`,
      DeviceListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }
}

export class DeviceListResponsesV4PagePaginationArray extends V4PagePaginationArray<DeviceListResponse> {}

export interface DeviceListResponse {
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

  cpuPctByApp?: Array<Array<DeviceListResponse.CPUPctByApp>> | null;

  deviceIpv4?: DeviceListResponse.DeviceIPV4;

  deviceIpv6?: DeviceListResponse.DeviceIPV6;

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

  gatewayIpv4?: DeviceListResponse.GatewayIPV4;

  gatewayIpv6?: DeviceListResponse.GatewayIPV6;

  handshakeLatencyMs?: number | null;

  ispIpv4?: DeviceListResponse.ISPIPV4;

  ispIpv6?: DeviceListResponse.ISPIPV6;

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

  ramUsedPctByApp?: Array<Array<DeviceListResponse.RamUsedPctByApp>> | null;

  switchLocked?: boolean | null;

  wifiStrengthDbm?: number | null;
}

export namespace DeviceListResponse {
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

export interface DeviceListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Unique identifier for account
   */
  account_id: string;

  /**
   * Query param: Time range beginning in ISO format
   */
  from: string;

  /**
   * Query param: Time range end in ISO format
   */
  to: string;

  /**
   * Query param: Cloudflare colo
   */
  colo?: string;

  /**
   * Query param: Device-specific ID, given as UUID v4
   */
  device_id?: string;

  /**
   * Query param: The mode under which the WARP client is run
   */
  mode?: string;

  /**
   * Query param: Operating system
   */
  platform?: string;

  /**
   * Query param: Dimension to sort results by
   */
  sort_by?: 'colo' | 'device_id' | 'mode' | 'platform' | 'status' | 'timestamp' | 'version';

  /**
   * Query param: Source:
   *
   * - `hourly` - device details aggregated hourly, up to 7 days prior
   * - `last_seen` - device details, up to 24 hours prior
   * - `raw` - device details, up to 7 days prior
   */
  source?: 'last_seen' | 'hourly' | 'raw';

  /**
   * Query param: Network status
   */
  status?: string;

  /**
   * Query param: WARP client version
   */
  version?: string;
}

Devices.DeviceListResponsesV4PagePaginationArray = DeviceListResponsesV4PagePaginationArray;

export declare namespace Devices {
  export {
    type DeviceListResponse as DeviceListResponse,
    DeviceListResponsesV4PagePaginationArray as DeviceListResponsesV4PagePaginationArray,
    type DeviceListParams as DeviceListParams,
  };
}
