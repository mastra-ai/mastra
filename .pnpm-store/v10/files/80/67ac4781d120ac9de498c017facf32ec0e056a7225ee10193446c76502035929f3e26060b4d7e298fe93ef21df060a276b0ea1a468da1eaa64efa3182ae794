"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
// noinspection ExceptionCaughtLocallyJS
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevOpsAPIHttpClient = void 0;
const http_client_1 = require("../../api/clients/http-client");
const errors_1 = require("../../devops/errors");
const timeout_managers_1 = require("../../api/timeout-managers");
const constants_1 = require("../../api/constants");
const devops_1 = require("../../devops");
const common_1 = require("../../common");
class DevOpsAPIHttpClient extends http_client_1.HttpClient {
    constructor(opts) {
        super(opts, [mkAuthHeaderProvider(opts.tokenProvider)]);
    }
    async request(req, options, started = 0) {
        const isLongRunning = started !== 0;
        try {
            const timeoutManager = options?.timeoutManager ?? this._timeoutManager(options?.maxTimeMS);
            const url = this.baseUrl + req.path;
            if (this.monitorCommands && !isLongRunning) {
                this.emitter.emit('adminCommandStarted', new devops_1.AdminCommandStartedEvent(req, isLongRunning, timeoutManager.ms));
            }
            started || (started = (0, http_client_1.hrTimeMs)());
            const resp = await this._request({
                url: url,
                method: req.method,
                params: req.params,
                data: JSON.stringify(req.data),
                forceHttp1: true,
                timeoutManager,
            });
            const data = resp.body ? (0, common_1.jsonTryParse)(resp.body, undefined) : undefined;
            if (resp.status >= 400) {
                throw new errors_1.DevOpsAPIResponseError(resp, data);
            }
            if (this.monitorCommands && !isLongRunning) {
                this.emitter.emit('adminCommandSucceeded', new devops_1.AdminCommandSucceededEvent(req, false, data, [], started));
            }
            return {
                data: data,
                status: resp.status,
                headers: resp.headers,
            };
        }
        catch (e) {
            if (!(e instanceof Error)) {
                throw e;
            }
            if (this.monitorCommands) {
                this.emitter.emit('adminCommandFailed', new devops_1.AdminCommandFailedEvent(req, isLongRunning, e, started));
            }
            throw e;
        }
    }
    async requestLongRunning(req, info) {
        const timeoutManager = this._timeoutManager(info.options?.maxTimeMS);
        const isLongRunning = info.options?.blocking !== false;
        if (this.monitorCommands) {
            this.emitter.emit('adminCommandStarted', new devops_1.AdminCommandStartedEvent(req, isLongRunning, timeoutManager.ms));
        }
        const started = (0, http_client_1.hrTimeMs)();
        const resp = await this.request(req, { timeoutManager }, started);
        const id = (typeof info.id === 'function')
            ? info.id(resp)
            : info.id;
        await this._awaitStatus(id, req, info, timeoutManager, started);
        if (this.monitorCommands && isLongRunning) {
            this.emitter.emit('adminCommandSucceeded', new devops_1.AdminCommandSucceededEvent(req, true, resp, [], started));
        }
        return resp;
    }
    _timeoutManager(timeout) {
        timeout ?? (timeout = this.fetchCtx.maxTimeMS ?? (12 * 60 * 1000));
        return new timeout_managers_1.TimeoutManager(timeout, (info) => new errors_1.DevOpsAPITimeoutError(info.url, timeout));
    }
    async _awaitStatus(id, req, info, timeoutManager, started) {
        if (info.options?.blocking === false) {
            return;
        }
        const pollInterval = info.options?.pollInterval || info.defaultPollInterval;
        let waiting = false;
        for (;;) {
            if (waiting) {
                continue;
            }
            waiting = true;
            if (this.monitorCommands) {
                this.emitter.emit('adminCommandPolling', new devops_1.AdminCommandPollingEvent(req, started, pollInterval));
            }
            const resp = await this.request({
                method: constants_1.HttpMethods.Get,
                path: `/databases/${id}`,
            }, {
                timeoutManager: timeoutManager,
            }, started);
            if (resp.data?.status === info.target) {
                break;
            }
            if (!info.legalStates.includes(resp.data?.status)) {
                const okStates = [info.target, ...info.legalStates];
                const error = new errors_1.DevOpsUnexpectedStateError(`Created database is not in any legal state [${okStates.join(',')}]`, okStates, resp.data);
                if (this.monitorCommands) {
                    this.emitter.emit('adminCommandFailed', new devops_1.AdminCommandFailedEvent(req, true, error, started));
                }
                throw error;
            }
            await new Promise((resolve) => {
                setTimeout(() => {
                    waiting = false;
                    resolve();
                }, pollInterval);
            });
        }
    }
}
exports.DevOpsAPIHttpClient = DevOpsAPIHttpClient;
const mkAuthHeaderProvider = (tp) => () => {
    const token = tp.getToken();
    return (token instanceof Promise)
        ? token.then(mkAuthHeader)
        : mkAuthHeader(token);
};
const mkAuthHeader = (token) => (token)
    ? { [constants_1.DEFAULT_DEVOPS_API_AUTH_HEADER]: `Bearer ${token}` }
    : {};
