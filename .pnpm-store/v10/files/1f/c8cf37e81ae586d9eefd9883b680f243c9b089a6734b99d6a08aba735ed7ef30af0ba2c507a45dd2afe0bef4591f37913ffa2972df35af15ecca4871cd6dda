"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEX = void 0;
const resource_1 = require("../../../resource.js");
const ColosAPI = __importStar(require("./colos.js"));
const colos_1 = require("./colos.js");
const TracerouteTestsAPI = __importStar(require("./traceroute-tests.js"));
const traceroute_tests_1 = require("./traceroute-tests.js");
const WARPChangeEventsAPI = __importStar(require("./warp-change-events.js"));
const warp_change_events_1 = require("./warp-change-events.js");
const CommandsAPI = __importStar(require("./commands/commands.js"));
const commands_1 = require("./commands/commands.js");
const FleetStatusAPI = __importStar(require("./fleet-status/fleet-status.js"));
const fleet_status_1 = require("./fleet-status/fleet-status.js");
const HTTPTestsAPI = __importStar(require("./http-tests/http-tests.js"));
const http_tests_1 = require("./http-tests/http-tests.js");
const TestsAPI = __importStar(require("./tests/tests.js"));
const tests_1 = require("./tests/tests.js");
const TracerouteTestResultsAPI = __importStar(require("./traceroute-test-results/traceroute-test-results.js"));
const traceroute_test_results_1 = require("./traceroute-test-results/traceroute-test-results.js");
class DEX extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.warpChangeEvents = new WARPChangeEventsAPI.WARPChangeEvents(this._client);
        this.commands = new CommandsAPI.Commands(this._client);
        this.colos = new ColosAPI.Colos(this._client);
        this.fleetStatus = new FleetStatusAPI.FleetStatus(this._client);
        this.httpTests = new HTTPTestsAPI.HTTPTests(this._client);
        this.tests = new TestsAPI.Tests(this._client);
        this.tracerouteTestResults = new TracerouteTestResultsAPI.TracerouteTestResults(this._client);
        this.tracerouteTests = new TracerouteTestsAPI.TracerouteTests(this._client);
    }
}
exports.DEX = DEX;
DEX.WARPChangeEvents = warp_change_events_1.WARPChangeEvents;
DEX.Commands = commands_1.Commands;
DEX.CommandListResponsesV4PagePagination = commands_1.CommandListResponsesV4PagePagination;
DEX.Colos = colos_1.Colos;
DEX.ColoListResponsesSinglePage = colos_1.ColoListResponsesSinglePage;
DEX.FleetStatus = fleet_status_1.FleetStatus;
DEX.HTTPTests = http_tests_1.HTTPTests;
DEX.TestsV4PagePagination = tests_1.TestsV4PagePagination;
DEX.TracerouteTestResults = traceroute_test_results_1.TracerouteTestResults;
DEX.TracerouteTests = traceroute_tests_1.TracerouteTests;
//# sourceMappingURL=dex.js.map