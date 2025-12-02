// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as ColosAPI from './colos';
import { ColoListParams, ColoListResponse, ColoListResponsesSinglePage, Colos } from './colos';
import * as TracerouteTestsAPI from './traceroute-tests';
import {
  Traceroute,
  TracerouteTestGetParams,
  TracerouteTestNetworkPathParams,
  TracerouteTestPercentilesParams,
  TracerouteTestPercentilesResponse,
  TracerouteTests,
} from './traceroute-tests';
import * as WARPChangeEventsAPI from './warp-change-events';
import { WARPChangeEventGetParams, WARPChangeEventGetResponse, WARPChangeEvents } from './warp-change-events';
import * as CommandsAPI from './commands/commands';
import {
  CommandCreateParams,
  CommandCreateResponse,
  CommandListParams,
  CommandListResponse,
  CommandListResponsesV4PagePagination,
  Commands,
} from './commands/commands';
import * as FleetStatusAPI from './fleet-status/fleet-status';
import {
  FleetStatus,
  FleetStatusLiveParams,
  FleetStatusLiveResponse,
  FleetStatusOverTimeParams,
  LiveStat,
} from './fleet-status/fleet-status';
import * as HTTPTestsAPI from './http-tests/http-tests';
import { HTTPDetails, HTTPTestGetParams, HTTPTests } from './http-tests/http-tests';
import * as TestsAPI from './tests/tests';
import { AggregateTimePeriod, TestListParams, Tests, TestsV4PagePagination } from './tests/tests';
import * as TracerouteTestResultsAPI from './traceroute-test-results/traceroute-test-results';
import { TracerouteTestResults } from './traceroute-test-results/traceroute-test-results';

export class DEX extends APIResource {
  warpChangeEvents: WARPChangeEventsAPI.WARPChangeEvents = new WARPChangeEventsAPI.WARPChangeEvents(
    this._client,
  );
  commands: CommandsAPI.Commands = new CommandsAPI.Commands(this._client);
  colos: ColosAPI.Colos = new ColosAPI.Colos(this._client);
  fleetStatus: FleetStatusAPI.FleetStatus = new FleetStatusAPI.FleetStatus(this._client);
  httpTests: HTTPTestsAPI.HTTPTests = new HTTPTestsAPI.HTTPTests(this._client);
  tests: TestsAPI.Tests = new TestsAPI.Tests(this._client);
  tracerouteTestResults: TracerouteTestResultsAPI.TracerouteTestResults =
    new TracerouteTestResultsAPI.TracerouteTestResults(this._client);
  tracerouteTests: TracerouteTestsAPI.TracerouteTests = new TracerouteTestsAPI.TracerouteTests(this._client);
}

export interface DigitalExperienceMonitor {
  id: string;

  /**
   * Whether the policy is the default for the account
   */
  default: boolean;

  name: string;
}

export interface NetworkPath {
  slots: Array<NetworkPath.Slot>;

  /**
   * Specifies the sampling applied, if any, to the slots response. When sampled,
   * results shown represent the first test run to the start of each sampling
   * interval.
   */
  sampling?: NetworkPath.Sampling | null;
}

export namespace NetworkPath {
  export interface Slot {
    /**
     * API Resource UUID tag.
     */
    id: string;

    /**
     * Round trip time in ms of the client to app mile
     */
    clientToAppRttMs: number | null;

    /**
     * Round trip time in ms of the client to Cloudflare egress mile
     */
    clientToCfEgressRttMs: number | null;

    /**
     * Round trip time in ms of the client to Cloudflare ingress mile
     */
    clientToCfIngressRttMs: number | null;

    timestamp: string;

    /**
     * Round trip time in ms of the client to ISP mile
     */
    clientToIspRttMs?: number | null;
  }

  /**
   * Specifies the sampling applied, if any, to the slots response. When sampled,
   * results shown represent the first test run to the start of each sampling
   * interval.
   */
  export interface Sampling {
    unit: 'hours';

    value: number;
  }
}

export interface NetworkPathResponse {
  /**
   * API Resource UUID tag.
   */
  id: string;

  deviceName?: string;

  /**
   * The interval at which the Traceroute synthetic application test is set to run.
   */
  interval?: string;

  kind?: 'traceroute';

  name?: string;

  networkPath?: NetworkPath | null;

  /**
   * The host of the Traceroute synthetic application test
   */
  url?: string;
}

export interface Percentiles {
  /**
   * p50 observed in the time period
   */
  p50?: number | null;

  /**
   * p90 observed in the time period
   */
  p90?: number | null;

  /**
   * p95 observed in the time period
   */
  p95?: number | null;

  /**
   * p99 observed in the time period
   */
  p99?: number | null;
}

DEX.WARPChangeEvents = WARPChangeEvents;
DEX.Commands = Commands;
DEX.CommandListResponsesV4PagePagination = CommandListResponsesV4PagePagination;
DEX.Colos = Colos;
DEX.ColoListResponsesSinglePage = ColoListResponsesSinglePage;
DEX.FleetStatus = FleetStatus;
DEX.HTTPTests = HTTPTests;
DEX.TestsV4PagePagination = TestsV4PagePagination;
DEX.TracerouteTestResults = TracerouteTestResults;
DEX.TracerouteTests = TracerouteTests;

export declare namespace DEX {
  export {
    type DigitalExperienceMonitor as DigitalExperienceMonitor,
    type NetworkPath as NetworkPath,
    type NetworkPathResponse as NetworkPathResponse,
    type Percentiles as Percentiles,
  };

  export {
    WARPChangeEvents as WARPChangeEvents,
    type WARPChangeEventGetResponse as WARPChangeEventGetResponse,
    type WARPChangeEventGetParams as WARPChangeEventGetParams,
  };

  export {
    Commands as Commands,
    type CommandCreateResponse as CommandCreateResponse,
    type CommandListResponse as CommandListResponse,
    CommandListResponsesV4PagePagination as CommandListResponsesV4PagePagination,
    type CommandCreateParams as CommandCreateParams,
    type CommandListParams as CommandListParams,
  };

  export {
    Colos as Colos,
    type ColoListResponse as ColoListResponse,
    ColoListResponsesSinglePage as ColoListResponsesSinglePage,
    type ColoListParams as ColoListParams,
  };

  export {
    FleetStatus as FleetStatus,
    type LiveStat as LiveStat,
    type FleetStatusLiveResponse as FleetStatusLiveResponse,
    type FleetStatusLiveParams as FleetStatusLiveParams,
    type FleetStatusOverTimeParams as FleetStatusOverTimeParams,
  };

  export {
    HTTPTests as HTTPTests,
    type HTTPDetails as HTTPDetails,
    type HTTPTestGetParams as HTTPTestGetParams,
  };

  export {
    type Tests as Tests,
    type AggregateTimePeriod as AggregateTimePeriod,
    TestsV4PagePagination as TestsV4PagePagination,
    type TestListParams as TestListParams,
  };

  export { TracerouteTestResults as TracerouteTestResults };

  export {
    TracerouteTests as TracerouteTests,
    type Traceroute as Traceroute,
    type TracerouteTestPercentilesResponse as TracerouteTestPercentilesResponse,
    type TracerouteTestGetParams as TracerouteTestGetParams,
    type TracerouteTestNetworkPathParams as TracerouteTestNetworkPathParams,
    type TracerouteTestPercentilesParams as TracerouteTestPercentilesParams,
  };
}
