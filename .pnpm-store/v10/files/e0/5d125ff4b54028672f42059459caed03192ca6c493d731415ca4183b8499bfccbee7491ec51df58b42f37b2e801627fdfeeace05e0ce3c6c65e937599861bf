import { SimpleEventEmitter } from "./eventemitter.mjs";
import { getFeatureFlagValue, normalizeFlagsResponse } from "./featureFlagUtils.mjs";
import { gzipCompress, isGzipSupported } from "./gzip.mjs";
import { createLogger } from "./logger.mjs";
import { PostHogPersistedProperty } from "./types.mjs";
import { PromiseQueue, STRING_FORMAT, allSettled, assert, currentISOTime, removeTrailingSlash, retriable, safeSetTimeout } from "./utils/index.mjs";
import { uuidv7 } from "./vendor/uuidv7.mjs";
class PostHogFetchHttpError extends Error {
    constructor(response, reqByteLength){
        super('HTTP error while fetching PostHog: status=' + response.status + ', reqByteLength=' + reqByteLength), this.response = response, this.reqByteLength = reqByteLength, this.name = 'PostHogFetchHttpError';
    }
    get status() {
        return this.response.status;
    }
    get text() {
        return this.response.text();
    }
    get json() {
        return this.response.json();
    }
}
class PostHogFetchNetworkError extends Error {
    constructor(error){
        super('Network error while fetching PostHog', error instanceof Error ? {
            cause: error
        } : {}), this.error = error, this.name = 'PostHogFetchNetworkError';
    }
}
const maybeAdd = (key, value)=>void 0 !== value ? {
        [key]: value
    } : {};
async function logFlushError(err) {
    if (err instanceof PostHogFetchHttpError) {
        let text = '';
        try {
            text = await err.text;
        } catch  {}
        console.error(`Error while flushing PostHog: message=${err.message}, response body=${text}`, err);
    } else console.error('Error while flushing PostHog', err);
    return Promise.resolve();
}
function isPostHogFetchError(err) {
    return 'object' == typeof err && (err instanceof PostHogFetchHttpError || err instanceof PostHogFetchNetworkError);
}
function isPostHogFetchContentTooLargeError(err) {
    return 'object' == typeof err && err instanceof PostHogFetchHttpError && 413 === err.status;
}
var posthog_core_stateless_QuotaLimitedFeature = /*#__PURE__*/ function(QuotaLimitedFeature) {
    QuotaLimitedFeature["FeatureFlags"] = "feature_flags";
    QuotaLimitedFeature["Recordings"] = "recordings";
    return QuotaLimitedFeature;
}({});
class PostHogCoreStateless {
    constructor(apiKey, options = {}){
        this.flushPromise = null;
        this.shutdownPromise = null;
        this.promiseQueue = new PromiseQueue();
        this._events = new SimpleEventEmitter();
        this._isInitialized = false;
        assert(apiKey, "You must pass your PostHog project's api key.");
        this.apiKey = apiKey;
        this.host = removeTrailingSlash(options.host || 'https://us.i.posthog.com');
        this.flushAt = options.flushAt ? Math.max(options.flushAt, 1) : 20;
        this.maxBatchSize = Math.max(this.flushAt, options.maxBatchSize ?? 100);
        this.maxQueueSize = Math.max(this.flushAt, options.maxQueueSize ?? 1000);
        this.flushInterval = options.flushInterval ?? 10000;
        this.preloadFeatureFlags = options.preloadFeatureFlags ?? true;
        this.defaultOptIn = options.defaultOptIn ?? true;
        this.disableSurveys = options.disableSurveys ?? false;
        this._retryOptions = {
            retryCount: options.fetchRetryCount ?? 3,
            retryDelay: options.fetchRetryDelay ?? 3000,
            retryCheck: isPostHogFetchError
        };
        this.requestTimeout = options.requestTimeout ?? 10000;
        this.featureFlagsRequestTimeoutMs = options.featureFlagsRequestTimeoutMs ?? 3000;
        this.remoteConfigRequestTimeoutMs = options.remoteConfigRequestTimeoutMs ?? 3000;
        this.disableGeoip = options.disableGeoip ?? true;
        this.disabled = options.disabled ?? false;
        this.historicalMigration = options?.historicalMigration ?? false;
        this.evaluationEnvironments = options?.evaluationEnvironments;
        this._initPromise = Promise.resolve();
        this._isInitialized = true;
        this._logger = createLogger('[PostHog]', this.logMsgIfDebug.bind(this));
        this.disableCompression = !isGzipSupported() || (options?.disableCompression ?? false);
    }
    logMsgIfDebug(fn) {
        if (this.isDebug) fn();
    }
    wrap(fn) {
        if (this.disabled) return void this._logger.warn('The client is disabled');
        if (this._isInitialized) return fn();
        this._initPromise.then(()=>fn());
    }
    getCommonEventProperties() {
        return {
            $lib: this.getLibraryId(),
            $lib_version: this.getLibraryVersion()
        };
    }
    get optedOut() {
        return this.getPersistedProperty(PostHogPersistedProperty.OptedOut) ?? !this.defaultOptIn;
    }
    async optIn() {
        this.wrap(()=>{
            this.setPersistedProperty(PostHogPersistedProperty.OptedOut, false);
        });
    }
    async optOut() {
        this.wrap(()=>{
            this.setPersistedProperty(PostHogPersistedProperty.OptedOut, true);
        });
    }
    on(event, cb) {
        return this._events.on(event, cb);
    }
    debug(enabled = true) {
        this.removeDebugCallback?.();
        if (enabled) {
            const removeDebugCallback = this.on('*', (event, payload)=>this._logger.info(event, payload));
            this.removeDebugCallback = ()=>{
                removeDebugCallback();
                this.removeDebugCallback = void 0;
            };
        }
    }
    get isDebug() {
        return !!this.removeDebugCallback;
    }
    get isDisabled() {
        return this.disabled;
    }
    buildPayload(payload) {
        return {
            distinct_id: payload.distinct_id,
            event: payload.event,
            properties: {
                ...payload.properties || {},
                ...this.getCommonEventProperties()
            }
        };
    }
    addPendingPromise(promise) {
        return this.promiseQueue.add(promise);
    }
    identifyStateless(distinctId, properties, options) {
        this.wrap(()=>{
            const payload = {
                ...this.buildPayload({
                    distinct_id: distinctId,
                    event: '$identify',
                    properties
                })
            };
            this.enqueue('identify', payload, options);
        });
    }
    async identifyStatelessImmediate(distinctId, properties, options) {
        const payload = {
            ...this.buildPayload({
                distinct_id: distinctId,
                event: '$identify',
                properties
            })
        };
        await this.sendImmediate('identify', payload, options);
    }
    captureStateless(distinctId, event, properties, options) {
        this.wrap(()=>{
            const payload = this.buildPayload({
                distinct_id: distinctId,
                event,
                properties
            });
            this.enqueue('capture', payload, options);
        });
    }
    async captureStatelessImmediate(distinctId, event, properties, options) {
        const payload = this.buildPayload({
            distinct_id: distinctId,
            event,
            properties
        });
        await this.sendImmediate('capture', payload, options);
    }
    aliasStateless(alias, distinctId, properties, options) {
        this.wrap(()=>{
            const payload = this.buildPayload({
                event: '$create_alias',
                distinct_id: distinctId,
                properties: {
                    ...properties || {},
                    distinct_id: distinctId,
                    alias
                }
            });
            this.enqueue('alias', payload, options);
        });
    }
    async aliasStatelessImmediate(alias, distinctId, properties, options) {
        const payload = this.buildPayload({
            event: '$create_alias',
            distinct_id: distinctId,
            properties: {
                ...properties || {},
                distinct_id: distinctId,
                alias
            }
        });
        await this.sendImmediate('alias', payload, options);
    }
    groupIdentifyStateless(groupType, groupKey, groupProperties, options, distinctId, eventProperties) {
        this.wrap(()=>{
            const payload = this.buildPayload({
                distinct_id: distinctId || `$${groupType}_${groupKey}`,
                event: '$groupidentify',
                properties: {
                    $group_type: groupType,
                    $group_key: groupKey,
                    $group_set: groupProperties || {},
                    ...eventProperties || {}
                }
            });
            this.enqueue('capture', payload, options);
        });
    }
    async getRemoteConfig() {
        await this._initPromise;
        let host = this.host;
        if ('https://us.i.posthog.com' === host) host = 'https://us-assets.i.posthog.com';
        else if ('https://eu.i.posthog.com' === host) host = 'https://eu-assets.i.posthog.com';
        const url = `${host}/array/${this.apiKey}/config`;
        const fetchOptions = {
            method: 'GET',
            headers: {
                ...this.getCustomHeaders(),
                'Content-Type': 'application/json'
            }
        };
        return this.fetchWithRetry(url, fetchOptions, {
            retryCount: 0
        }, this.remoteConfigRequestTimeoutMs).then((response)=>response.json()).catch((error)=>{
            this._logger.error('Remote config could not be loaded', error);
            this._events.emit('error', error);
        });
    }
    async getFlags(distinctId, groups = {}, personProperties = {}, groupProperties = {}, extraPayload = {}) {
        await this._initPromise;
        const url = `${this.host}/flags/?v=2&config=true`;
        const requestData = {
            token: this.apiKey,
            distinct_id: distinctId,
            groups,
            person_properties: personProperties,
            group_properties: groupProperties,
            ...extraPayload
        };
        if (this.evaluationEnvironments && this.evaluationEnvironments.length > 0) requestData.evaluation_environments = this.evaluationEnvironments;
        const fetchOptions = {
            method: 'POST',
            headers: {
                ...this.getCustomHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        };
        this._logger.info('Flags URL', url);
        return this.fetchWithRetry(url, fetchOptions, {
            retryCount: 0
        }, this.featureFlagsRequestTimeoutMs).then((response)=>response.json()).then((response)=>normalizeFlagsResponse(response)).catch((error)=>{
            this._events.emit('error', error);
        });
    }
    async getFeatureFlagStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
        await this._initPromise;
        const flagDetailResponse = await this.getFeatureFlagDetailStateless(key, distinctId, groups, personProperties, groupProperties, disableGeoip);
        if (void 0 === flagDetailResponse) return {
            response: void 0,
            requestId: void 0
        };
        let response = getFeatureFlagValue(flagDetailResponse.response);
        if (void 0 === response) response = false;
        return {
            response,
            requestId: flagDetailResponse.requestId
        };
    }
    async getFeatureFlagDetailStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
        await this._initPromise;
        const flagsResponse = await this.getFeatureFlagDetailsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, [
            key
        ]);
        if (void 0 === flagsResponse) return;
        const featureFlags = flagsResponse.flags;
        const flagDetail = featureFlags[key];
        return {
            response: flagDetail,
            requestId: flagsResponse.requestId
        };
    }
    async getFeatureFlagPayloadStateless(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip) {
        await this._initPromise;
        const payloads = await this.getFeatureFlagPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, [
            key
        ]);
        if (!payloads) return;
        const response = payloads[key];
        if (void 0 === response) return null;
        return response;
    }
    async getFeatureFlagPayloadsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        const payloads = (await this.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate)).payloads;
        return payloads;
    }
    async getFeatureFlagsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        return await this.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate);
    }
    async getFeatureFlagsAndPayloadsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        const featureFlagDetails = await this.getFeatureFlagDetailsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeysToEvaluate);
        if (!featureFlagDetails) return {
            flags: void 0,
            payloads: void 0,
            requestId: void 0
        };
        return {
            flags: featureFlagDetails.featureFlags,
            payloads: featureFlagDetails.featureFlagPayloads,
            requestId: featureFlagDetails.requestId
        };
    }
    async getFeatureFlagDetailsStateless(distinctId, groups = {}, personProperties = {}, groupProperties = {}, disableGeoip, flagKeysToEvaluate) {
        await this._initPromise;
        const extraPayload = {};
        if (disableGeoip ?? this.disableGeoip) extraPayload['geoip_disable'] = true;
        if (flagKeysToEvaluate) extraPayload['flag_keys_to_evaluate'] = flagKeysToEvaluate;
        const flagsResponse = await this.getFlags(distinctId, groups, personProperties, groupProperties, extraPayload);
        if (void 0 === flagsResponse) return;
        if (flagsResponse.errorsWhileComputingFlags) console.error('[FEATURE FLAGS] Error while computing feature flags, some flags may be missing or incorrect. Learn more at https://posthog.com/docs/feature-flags/best-practices');
        if (flagsResponse.quotaLimited?.includes("feature_flags")) {
            console.warn('[FEATURE FLAGS] Feature flags quota limit exceeded - feature flags unavailable. Learn more about billing limits at https://posthog.com/docs/billing/limits-alerts');
            return {
                flags: {},
                featureFlags: {},
                featureFlagPayloads: {},
                requestId: flagsResponse?.requestId
            };
        }
        return flagsResponse;
    }
    async getSurveysStateless() {
        await this._initPromise;
        if (true === this.disableSurveys) {
            this._logger.info('Loading surveys is disabled.');
            return [];
        }
        const url = `${this.host}/api/surveys/?token=${this.apiKey}`;
        const fetchOptions = {
            method: 'GET',
            headers: {
                ...this.getCustomHeaders(),
                'Content-Type': 'application/json'
            }
        };
        const response = await this.fetchWithRetry(url, fetchOptions).then((response)=>{
            if (200 !== response.status || !response.json) {
                const msg = `Surveys API could not be loaded: ${response.status}`;
                const error = new Error(msg);
                this._logger.error(error);
                this._events.emit('error', new Error(msg));
                return;
            }
            return response.json();
        }).catch((error)=>{
            this._logger.error('Surveys API could not be loaded', error);
            this._events.emit('error', error);
        });
        const newSurveys = response?.surveys;
        if (newSurveys) this._logger.info('Surveys fetched from API: ', JSON.stringify(newSurveys));
        return newSurveys ?? [];
    }
    get props() {
        if (!this._props) this._props = this.getPersistedProperty(PostHogPersistedProperty.Props);
        return this._props || {};
    }
    set props(val) {
        this._props = val;
    }
    async register(properties) {
        this.wrap(()=>{
            this.props = {
                ...this.props,
                ...properties
            };
            this.setPersistedProperty(PostHogPersistedProperty.Props, this.props);
        });
    }
    async unregister(property) {
        this.wrap(()=>{
            delete this.props[property];
            this.setPersistedProperty(PostHogPersistedProperty.Props, this.props);
        });
    }
    enqueue(type, _message, options) {
        this.wrap(()=>{
            if (this.optedOut) return void this._events.emit(type, "Library is disabled. Not sending event. To re-enable, call posthog.optIn()");
            const message = this.prepareMessage(type, _message, options);
            const queue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
            if (queue.length >= this.maxQueueSize) {
                queue.shift();
                this._logger.info('Queue is full, the oldest event is dropped.');
            }
            queue.push({
                message
            });
            this.setPersistedProperty(PostHogPersistedProperty.Queue, queue);
            this._events.emit(type, message);
            if (queue.length >= this.flushAt) this.flushBackground();
            if (this.flushInterval && !this._flushTimer) this._flushTimer = safeSetTimeout(()=>this.flushBackground(), this.flushInterval);
        });
    }
    async sendImmediate(type, _message, options) {
        if (this.disabled) return void this._logger.warn('The client is disabled');
        if (!this._isInitialized) await this._initPromise;
        if (this.optedOut) return void this._events.emit(type, "Library is disabled. Not sending event. To re-enable, call posthog.optIn()");
        const data = {
            api_key: this.apiKey,
            batch: [
                this.prepareMessage(type, _message, options)
            ],
            sent_at: currentISOTime()
        };
        if (this.historicalMigration) data.historical_migration = true;
        const payload = JSON.stringify(data);
        const url = `${this.host}/batch/`;
        const gzippedPayload = this.disableCompression ? null : await gzipCompress(payload, this.isDebug);
        const fetchOptions = {
            method: 'POST',
            headers: {
                ...this.getCustomHeaders(),
                'Content-Type': 'application/json',
                ...null !== gzippedPayload && {
                    'Content-Encoding': 'gzip'
                }
            },
            body: gzippedPayload || payload
        };
        try {
            await this.fetchWithRetry(url, fetchOptions);
        } catch (err) {
            this._events.emit('error', err);
        }
    }
    prepareMessage(type, _message, options) {
        const message = {
            ..._message,
            type: type,
            library: this.getLibraryId(),
            library_version: this.getLibraryVersion(),
            timestamp: options?.timestamp ? options?.timestamp : currentISOTime(),
            uuid: options?.uuid ? options.uuid : uuidv7()
        };
        const addGeoipDisableProperty = options?.disableGeoip ?? this.disableGeoip;
        if (addGeoipDisableProperty) {
            if (!message.properties) message.properties = {};
            message['properties']['$geoip_disable'] = true;
        }
        if (message.distinctId) {
            message.distinct_id = message.distinctId;
            delete message.distinctId;
        }
        return message;
    }
    clearFlushTimer() {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = void 0;
        }
    }
    flushBackground() {
        this.flush().catch(async (err)=>{
            await logFlushError(err);
        });
    }
    async flush() {
        const nextFlushPromise = allSettled([
            this.flushPromise
        ]).then(()=>this._flush());
        this.flushPromise = nextFlushPromise;
        this.addPendingPromise(nextFlushPromise);
        allSettled([
            nextFlushPromise
        ]).then(()=>{
            if (this.flushPromise === nextFlushPromise) this.flushPromise = null;
        });
        return nextFlushPromise;
    }
    getCustomHeaders() {
        const customUserAgent = this.getCustomUserAgent();
        const headers = {};
        if (customUserAgent && '' !== customUserAgent) headers['User-Agent'] = customUserAgent;
        return headers;
    }
    async _flush() {
        this.clearFlushTimer();
        await this._initPromise;
        let queue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
        if (!queue.length) return;
        const sentMessages = [];
        const originalQueueLength = queue.length;
        while(queue.length > 0 && sentMessages.length < originalQueueLength){
            const batchItems = queue.slice(0, this.maxBatchSize);
            const batchMessages = batchItems.map((item)=>item.message);
            const persistQueueChange = ()=>{
                const refreshedQueue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
                const newQueue = refreshedQueue.slice(batchItems.length);
                this.setPersistedProperty(PostHogPersistedProperty.Queue, newQueue);
                queue = newQueue;
            };
            const data = {
                api_key: this.apiKey,
                batch: batchMessages,
                sent_at: currentISOTime()
            };
            if (this.historicalMigration) data.historical_migration = true;
            const payload = JSON.stringify(data);
            const url = `${this.host}/batch/`;
            const gzippedPayload = this.disableCompression ? null : await gzipCompress(payload, this.isDebug);
            const fetchOptions = {
                method: 'POST',
                headers: {
                    ...this.getCustomHeaders(),
                    'Content-Type': 'application/json',
                    ...null !== gzippedPayload && {
                        'Content-Encoding': 'gzip'
                    }
                },
                body: gzippedPayload || payload
            };
            const retryOptions = {
                retryCheck: (err)=>{
                    if (isPostHogFetchContentTooLargeError(err)) return false;
                    return isPostHogFetchError(err);
                }
            };
            try {
                await this.fetchWithRetry(url, fetchOptions, retryOptions);
            } catch (err) {
                if (isPostHogFetchContentTooLargeError(err) && batchMessages.length > 1) {
                    this.maxBatchSize = Math.max(1, Math.floor(batchMessages.length / 2));
                    this._logger.warn(`Received 413 when sending batch of size ${batchMessages.length}, reducing batch size to ${this.maxBatchSize}`);
                    continue;
                }
                if (!(err instanceof PostHogFetchNetworkError)) persistQueueChange();
                this._events.emit('error', err);
                throw err;
            }
            persistQueueChange();
            sentMessages.push(...batchMessages);
        }
        this._events.emit('flush', sentMessages);
    }
    async fetchWithRetry(url, options, retryOptions, requestTimeout) {
        AbortSignal.timeout ??= function(ms) {
            const ctrl = new AbortController();
            setTimeout(()=>ctrl.abort(), ms);
            return ctrl.signal;
        };
        const body = options.body ? options.body : '';
        let reqByteLength = -1;
        try {
            reqByteLength = body instanceof Blob ? body.size : Buffer.byteLength(body, STRING_FORMAT);
        } catch  {
            if (body instanceof Blob) reqByteLength = body.size;
            else {
                const encoded = new TextEncoder().encode(body);
                reqByteLength = encoded.length;
            }
        }
        return await retriable(async ()=>{
            let res = null;
            try {
                res = await this.fetch(url, {
                    signal: AbortSignal.timeout(requestTimeout ?? this.requestTimeout),
                    ...options
                });
            } catch (e) {
                throw new PostHogFetchNetworkError(e);
            }
            const isNoCors = 'no-cors' === options.mode;
            if (!isNoCors && (res.status < 200 || res.status >= 400)) throw new PostHogFetchHttpError(res, reqByteLength);
            return res;
        }, {
            ...this._retryOptions,
            ...retryOptions
        });
    }
    async _shutdown(shutdownTimeoutMs = 30000) {
        await this._initPromise;
        let hasTimedOut = false;
        this.clearFlushTimer();
        const doShutdown = async ()=>{
            try {
                await this.promiseQueue.join();
                while(true){
                    const queue = this.getPersistedProperty(PostHogPersistedProperty.Queue) || [];
                    if (0 === queue.length) break;
                    await this.flush();
                    if (hasTimedOut) break;
                }
            } catch (e) {
                if (!isPostHogFetchError(e)) throw e;
                await logFlushError(e);
            }
        };
        return Promise.race([
            new Promise((_, reject)=>{
                safeSetTimeout(()=>{
                    this._logger.error('Timed out while shutting down PostHog');
                    hasTimedOut = true;
                    reject('Timeout while shutting down PostHog. Some events may not have been sent.');
                }, shutdownTimeoutMs);
            }),
            doShutdown()
        ]);
    }
    async shutdown(shutdownTimeoutMs = 30000) {
        if (this.shutdownPromise) this._logger.warn('shutdown() called while already shutting down. shutdown() is meant to be called once before process exit - use flush() for per-request cleanup');
        else this.shutdownPromise = this._shutdown(shutdownTimeoutMs).finally(()=>{
            this.shutdownPromise = null;
        });
        return this.shutdownPromise;
    }
}
export { PostHogCoreStateless, posthog_core_stateless_QuotaLimitedFeature as QuotaLimitedFeature, logFlushError, maybeAdd };
