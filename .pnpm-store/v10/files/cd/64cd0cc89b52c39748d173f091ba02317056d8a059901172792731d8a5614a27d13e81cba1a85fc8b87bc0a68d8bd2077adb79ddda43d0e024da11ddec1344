import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as TestsAPI from "./tests.js";
import * as DEXAPI from "../dex.js";
import * as UniqueDevicesAPI from "./unique-devices.js";
import { UniqueDeviceListParams, UniqueDevices } from "./unique-devices.js";
import { V4PagePagination, type V4PagePaginationParams } from "../../../../pagination.js";
export declare class Tests extends APIResource {
    uniqueDevices: UniqueDevicesAPI.UniqueDevices;
    /**
     * List DEX tests with overview metrics
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tests of client.zeroTrust.dex.tests.list({
     *   account_id: '01a7362d577a6c3019a474fd6f485823',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: TestListParams, options?: Core.RequestOptions): Core.PagePromise<TestsV4PagePagination, Tests>;
}
export declare class TestsV4PagePagination extends V4PagePagination<Tests> {
}
export interface AggregateTimePeriod {
    units: 'hours' | 'days' | 'testRuns';
    value: number;
}
export interface Tests {
    overviewMetrics: Tests.OverviewMetrics;
    /**
     * array of test results objects.
     */
    tests: Array<Tests.Test>;
}
export declare namespace Tests {
    interface OverviewMetrics {
        /**
         * number of tests.
         */
        testsTotal: number;
        /**
         * percentage availability for all HTTP test results in response
         */
        avgHttpAvailabilityPct?: number | null;
        /**
         * percentage availability for all traceroutes results in response
         */
        avgTracerouteAvailabilityPct?: number | null;
    }
    interface Test {
        /**
         * API Resource UUID tag.
         */
        id: string;
        /**
         * date the test was created.
         */
        created: string;
        /**
         * the test description defined during configuration
         */
        description: string;
        /**
         * if true, then the test will run on targeted devices. Else, the test will not
         * run.
         */
        enabled: boolean;
        host: string;
        /**
         * The interval at which the synthetic application test is set to run.
         */
        interval: string;
        /**
         * test type, http or traceroute
         */
        kind: 'http' | 'traceroute';
        /**
         * name given to this test
         */
        name: string;
        updated: string;
        httpResults?: Test.HTTPResults | null;
        httpResultsByColo?: Array<Test.HTTPResultsByColo>;
        /**
         * for HTTP, the method to use when running the test
         */
        method?: string;
        target_policies?: Array<DEXAPI.DigitalExperienceMonitor> | null;
        targeted?: boolean;
        tracerouteResults?: Test.TracerouteResults | null;
        tracerouteResultsByColo?: Array<Test.TracerouteResultsByColo>;
    }
    namespace Test {
        interface HTTPResults {
            resourceFetchTime: HTTPResults.ResourceFetchTime;
        }
        namespace HTTPResults {
            interface ResourceFetchTime {
                history: Array<ResourceFetchTime.History>;
                avgMs?: number | null;
                overTime?: ResourceFetchTime.OverTime | null;
            }
            namespace ResourceFetchTime {
                interface History {
                    timePeriod: TestsAPI.AggregateTimePeriod;
                    avgMs?: number | null;
                    deltaPct?: number | null;
                }
                interface OverTime {
                    timePeriod: TestsAPI.AggregateTimePeriod;
                    values: Array<OverTime.Value>;
                }
                namespace OverTime {
                    interface Value {
                        avgMs: number;
                        timestamp: string;
                    }
                }
            }
        }
        interface HTTPResultsByColo {
            /**
             * Cloudflare colo
             */
            colo: string;
            resourceFetchTime: HTTPResultsByColo.ResourceFetchTime;
        }
        namespace HTTPResultsByColo {
            interface ResourceFetchTime {
                history: Array<ResourceFetchTime.History>;
                avgMs?: number | null;
                overTime?: ResourceFetchTime.OverTime | null;
            }
            namespace ResourceFetchTime {
                interface History {
                    timePeriod: TestsAPI.AggregateTimePeriod;
                    avgMs?: number | null;
                    deltaPct?: number | null;
                }
                interface OverTime {
                    timePeriod: TestsAPI.AggregateTimePeriod;
                    values: Array<OverTime.Value>;
                }
                namespace OverTime {
                    interface Value {
                        avgMs: number;
                        timestamp: string;
                    }
                }
            }
        }
        interface TracerouteResults {
            roundTripTime: TracerouteResults.RoundTripTime;
        }
        namespace TracerouteResults {
            interface RoundTripTime {
                history: Array<RoundTripTime.History>;
                avgMs?: number | null;
                overTime?: RoundTripTime.OverTime | null;
            }
            namespace RoundTripTime {
                interface History {
                    timePeriod: TestsAPI.AggregateTimePeriod;
                    avgMs?: number | null;
                    deltaPct?: number | null;
                }
                interface OverTime {
                    timePeriod: TestsAPI.AggregateTimePeriod;
                    values: Array<OverTime.Value>;
                }
                namespace OverTime {
                    interface Value {
                        avgMs: number;
                        timestamp: string;
                    }
                }
            }
        }
        interface TracerouteResultsByColo {
            /**
             * Cloudflare colo
             */
            colo: string;
            roundTripTime: TracerouteResultsByColo.RoundTripTime;
        }
        namespace TracerouteResultsByColo {
            interface RoundTripTime {
                history: Array<RoundTripTime.History>;
                avgMs?: number | null;
                overTime?: RoundTripTime.OverTime | null;
            }
            namespace RoundTripTime {
                interface History {
                    timePeriod: TestsAPI.AggregateTimePeriod;
                    avgMs?: number | null;
                    deltaPct?: number | null;
                }
                interface OverTime {
                    timePeriod: TestsAPI.AggregateTimePeriod;
                    values: Array<OverTime.Value>;
                }
                namespace OverTime {
                    interface Value {
                        avgMs: number;
                        timestamp: string;
                    }
                }
            }
        }
    }
}
export interface TestListParams extends V4PagePaginationParams {
    /**
     * Path param: unique identifier linked to an account in the API request path.
     */
    account_id: string;
    /**
     * Query param: Optionally filter result stats to a Cloudflare colo. Cannot be used
     * in combination with deviceId param.
     */
    colo?: string;
    /**
     * Query param: Optionally filter result stats to a specific device(s). Cannot be
     * used in combination with colo param.
     */
    deviceId?: Array<string>;
    /**
     * Query param: Optionally filter results by test name
     */
    testName?: string;
}
export declare namespace Tests {
    export { type AggregateTimePeriod as AggregateTimePeriod, type Tests as Tests, TestsV4PagePagination as TestsV4PagePagination, type TestListParams as TestListParams, };
    export { type UniqueDevices as UniqueDevices, type UniqueDeviceListParams as UniqueDeviceListParams };
}
//# sourceMappingURL=tests.d.ts.map