"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticsResult = exports.DiagnosticsEndpoint = exports.PingResult = exports.PingEndpoint = exports.PingState = exports.EndpointState = void 0;
/**
 * Represents the status of an an endpoint in a diagnostics report.
 *
 * @category Diagnostics
 */
var EndpointState;
(function (EndpointState) {
    /**
     * Indicates the endpoint is disconnected.
     */
    EndpointState[EndpointState["Disconnected"] = 0] = "Disconnected";
    /**
     * Indicates the endpoint is still connecting.
     */
    EndpointState[EndpointState["Connecting"] = 1] = "Connecting";
    /**
     * Indicates the endpoint is connected.
     */
    EndpointState[EndpointState["Connected"] = 2] = "Connected";
    /**
     * Indicates the endpoint is disconnecting.
     */
    EndpointState[EndpointState["Disconnecting"] = 3] = "Disconnecting";
})(EndpointState || (exports.EndpointState = EndpointState = {}));
/**
 * Represents the status of an an endpoint in a ping report.
 */
var PingState;
(function (PingState) {
    /**
     * Indicates the endpoint was pinged successfully.
     */
    PingState[PingState["Ok"] = 0] = "Ok";
    /**
     * Indicates the endpoint timed out during the ping.
     */
    PingState[PingState["Timeout"] = 1] = "Timeout";
    /**
     * Indicates an error occured trying to ping the endpoint.
     */
    PingState[PingState["Error"] = 2] = "Error";
})(PingState || (exports.PingState = PingState = {}));
/**
 * PingEndpoint represents a single endpoint in a ping result.
 *
 * @category Diagnostics
 */
class PingEndpoint {
    /**
     * @internal
     */
    constructor(data) {
        this.type = data.type;
        this.id = data.id;
        this.latency = data.latency;
        this.remote = data.remote;
        this.local = data.local;
        this.state = data.state;
        this.bucket = data.bucket;
        this.error = data.error;
    }
}
exports.PingEndpoint = PingEndpoint;
/**
 * PingResult represents the output of a ping operation.
 *
 * @category Diagnostics
 */
class PingResult {
    /**
     * @internal
     */
    constructor(data) {
        this.version = data.version;
        this.id = data.id;
        this.sdk = data.sdk;
        this.services = data.services;
    }
    /**
     * Returns a JSON formatted ping report.
     */
    toJSON() {
        return {
            version: this.version,
            id: this.id,
            sdk: this.sdk,
            services: Object.fromEntries(Object.entries(this.services).map(([serviceType, services]) => {
                return [
                    serviceType,
                    services.map((svc) => {
                        return {
                            latency_us: svc.latency * 1000000,
                            remote: svc.remote,
                            local: svc.local,
                            id: svc.id,
                            state: svc.state, // state enum is already a string
                            namespace: svc.bucket,
                            error: svc.error,
                        };
                    }),
                ];
            })),
        };
    }
}
exports.PingResult = PingResult;
/**
 * DiagnosticsEndpoint represents a single endpoint in a diagnostics
 * result.
 *
 * @category Diagnostics
 */
class DiagnosticsEndpoint {
    /**
     * @internal
     */
    constructor(data) {
        this.type = data.type;
        this.id = data.id;
        this.local = data.local;
        this.remote = data.remote;
        this.lastActivity = data.lastActivity;
        this.state = data.state;
    }
}
exports.DiagnosticsEndpoint = DiagnosticsEndpoint;
/**
 * DiagnosticsResult represents the output of a operation result.
 *
 * @category Diagnostics
 */
class DiagnosticsResult {
    /**
     * @internal
     */
    constructor(data) {
        this.version = data.version;
        this.id = data.id;
        this.sdk = data.sdk;
        this.services = data.services;
    }
    /**
     * Returns a JSON formatted diagnostics report.
     */
    toJSON() {
        return {
            version: this.version,
            id: this.id,
            sdk: this.sdk,
            services: Object.fromEntries(Object.entries(this.services).map(([serviceType, services]) => {
                return [
                    serviceType,
                    services.map((svc) => {
                        return {
                            last_activity_us: svc.lastActivity * 1000000,
                            remote: svc.remote,
                            local: svc.local,
                            id: svc.id,
                            state: svc.state, // state enum is already a string
                            namespace: svc.bucket,
                            details: svc.details,
                        };
                    }),
                ];
            })),
        };
    }
}
exports.DiagnosticsResult = DiagnosticsResult;
