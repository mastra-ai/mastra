import { APIResource } from "../../../resource.js";
import * as ColosAPI from "./colos.js";
import { ColoListParams, ColoListResponse, ColoListResponsesSinglePage, Colos } from "./colos.js";
import * as TracerouteTestsAPI from "./traceroute-tests.js";
import { Traceroute, TracerouteTestGetParams, TracerouteTestNetworkPathParams, TracerouteTestPercentilesParams, TracerouteTestPercentilesResponse, TracerouteTests } from "./traceroute-tests.js";
import * as WARPChangeEventsAPI from "./warp-change-events.js";
import { WARPChangeEventGetParams, WARPChangeEventGetResponse, WARPChangeEvents } from "./warp-change-events.js";
import * as CommandsAPI from "./commands/commands.js";
import { CommandCreateParams, CommandCreateResponse, CommandListParams, CommandListResponse, CommandListResponsesV4PagePagination, Commands } from "./commands/commands.js";
import * as FleetStatusAPI from "./fleet-status/fleet-status.js";
import { FleetStatus, FleetStatusLiveParams, FleetStatusLiveResponse, FleetStatusOverTimeParams, LiveStat } from "./fleet-status/fleet-status.js";
import * as HTTPTestsAPI from "./http-tests/http-tests.js";
import { HTTPDetails, HTTPTestGetParams, HTTPTests } from "./http-tests/http-tests.js";
import * as TestsAPI from "./tests/tests.js";
import { AggregateTimePeriod, TestListParams, Tests, TestsV4PagePagination } from "./tests/tests.js";
import * as TracerouteTestResultsAPI from "./traceroute-test-results/traceroute-test-results.js";
import { TracerouteTestResults } from "./traceroute-test-results/traceroute-test-results.js";
export declare class DEX extends APIResource {
    warpChangeEvents: WARPChangeEventsAPI.WARPChangeEvents;
    commands: CommandsAPI.Commands;
    colos: ColosAPI.Colos;
    fleetStatus: FleetStatusAPI.FleetStatus;
    httpTests: HTTPTestsAPI.HTTPTests;
    tests: TestsAPI.Tests;
    tracerouteTestResults: TracerouteTestResultsAPI.TracerouteTestResults;
    tracerouteTests: TracerouteTestsAPI.TracerouteTests;
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
export declare namespace NetworkPath {
    interface Slot {
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
    interface Sampling {
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
export declare namespace DEX {
    export { type DigitalExperienceMonitor as DigitalExperienceMonitor, type NetworkPath as NetworkPath, type NetworkPathResponse as NetworkPathResponse, type Percentiles as Percentiles, };
    export { WARPChangeEvents as WARPChangeEvents, type WARPChangeEventGetResponse as WARPChangeEventGetResponse, type WARPChangeEventGetParams as WARPChangeEventGetParams, };
    export { Commands as Commands, type CommandCreateResponse as CommandCreateResponse, type CommandListResponse as CommandListResponse, CommandListResponsesV4PagePagination as CommandListResponsesV4PagePagination, type CommandCreateParams as CommandCreateParams, type CommandListParams as CommandListParams, };
    export { Colos as Colos, type ColoListResponse as ColoListResponse, ColoListResponsesSinglePage as ColoListResponsesSinglePage, type ColoListParams as ColoListParams, };
    export { FleetStatus as FleetStatus, type LiveStat as LiveStat, type FleetStatusLiveResponse as FleetStatusLiveResponse, type FleetStatusLiveParams as FleetStatusLiveParams, type FleetStatusOverTimeParams as FleetStatusOverTimeParams, };
    export { HTTPTests as HTTPTests, type HTTPDetails as HTTPDetails, type HTTPTestGetParams as HTTPTestGetParams, };
    export { type Tests as Tests, type AggregateTimePeriod as AggregateTimePeriod, TestsV4PagePagination as TestsV4PagePagination, type TestListParams as TestListParams, };
    export { TracerouteTestResults as TracerouteTestResults };
    export { TracerouteTests as TracerouteTests, type Traceroute as Traceroute, type TracerouteTestPercentilesResponse as TracerouteTestPercentilesResponse, type TracerouteTestGetParams as TracerouteTestGetParams, type TracerouteTestNetworkPathParams as TracerouteTestNetworkPathParams, type TracerouteTestPercentilesParams as TracerouteTestPercentilesParams, };
}
//# sourceMappingURL=dex.d.ts.map