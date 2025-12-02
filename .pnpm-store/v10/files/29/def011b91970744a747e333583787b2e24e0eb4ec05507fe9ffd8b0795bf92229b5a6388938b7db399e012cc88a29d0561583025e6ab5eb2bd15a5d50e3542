"use strict";
var __webpack_require__ = {};
(()=>{
    __webpack_require__.d = (exports1, definition)=>{
        for(var key in definition)if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports1, key)) Object.defineProperty(exports1, key, {
            enumerable: true,
            get: definition[key]
        });
    };
})();
(()=>{
    __webpack_require__.o = (obj, prop)=>Object.prototype.hasOwnProperty.call(obj, prop);
})();
(()=>{
    __webpack_require__.r = (exports1)=>{
        if ('undefined' != typeof Symbol && Symbol.toStringTag) Object.defineProperty(exports1, Symbol.toStringTag, {
            value: 'Module'
        });
        Object.defineProperty(exports1, '__esModule', {
            value: true
        });
    };
})();
var __webpack_exports__ = {};
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
    PostHogCore: ()=>PostHogCore
});
const external_featureFlagUtils_js_namespaceObject = require("./featureFlagUtils.js");
const external_types_js_namespaceObject = require("./types.js");
const external_posthog_core_stateless_js_namespaceObject = require("./posthog-core-stateless.js");
const uuidv7_js_namespaceObject = require("./vendor/uuidv7.js");
const index_js_namespaceObject = require("./utils/index.js");
class PostHogCore extends external_posthog_core_stateless_js_namespaceObject.PostHogCoreStateless {
    constructor(apiKey, options){
        const disableGeoipOption = options?.disableGeoip ?? false;
        const featureFlagsRequestTimeoutMs = options?.featureFlagsRequestTimeoutMs ?? 10000;
        super(apiKey, {
            ...options,
            disableGeoip: disableGeoipOption,
            featureFlagsRequestTimeoutMs
        }), this.flagCallReported = {}, this._sessionMaxLengthSeconds = 86400, this.sessionProps = {};
        this.sendFeatureFlagEvent = options?.sendFeatureFlagEvent ?? true;
        this._sessionExpirationTimeSeconds = options?.sessionExpirationTimeSeconds ?? 1800;
    }
    setupBootstrap(options) {
        const bootstrap = options?.bootstrap;
        if (!bootstrap) return;
        if (bootstrap.distinctId) if (bootstrap.isIdentifiedId) {
            const distinctId = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.DistinctId);
            if (!distinctId) this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.DistinctId, bootstrap.distinctId);
        } else {
            const anonymousId = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.AnonymousId);
            if (!anonymousId) this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.AnonymousId, bootstrap.distinctId);
        }
        const bootstrapFeatureFlags = bootstrap.featureFlags;
        const bootstrapFeatureFlagPayloads = bootstrap.featureFlagPayloads ?? {};
        if (bootstrapFeatureFlags && Object.keys(bootstrapFeatureFlags).length) {
            const normalizedBootstrapFeatureFlagDetails = (0, external_featureFlagUtils_js_namespaceObject.createFlagsResponseFromFlagsAndPayloads)(bootstrapFeatureFlags, bootstrapFeatureFlagPayloads);
            if (Object.keys(normalizedBootstrapFeatureFlagDetails.flags).length > 0) {
                this.setBootstrappedFeatureFlagDetails(normalizedBootstrapFeatureFlagDetails);
                const currentFeatureFlagDetails = this.getKnownFeatureFlagDetails() || {
                    flags: {},
                    requestId: void 0
                };
                const newFeatureFlagDetails = {
                    flags: {
                        ...normalizedBootstrapFeatureFlagDetails.flags,
                        ...currentFeatureFlagDetails.flags
                    },
                    requestId: normalizedBootstrapFeatureFlagDetails.requestId
                };
                this.setKnownFeatureFlagDetails(newFeatureFlagDetails);
            }
        }
    }
    clearProps() {
        this.props = void 0;
        this.sessionProps = {};
        this.flagCallReported = {};
    }
    on(event, cb) {
        return this._events.on(event, cb);
    }
    reset(propertiesToKeep) {
        this.wrap(()=>{
            const allPropertiesToKeep = [
                external_types_js_namespaceObject.PostHogPersistedProperty.Queue,
                ...propertiesToKeep || []
            ];
            this.clearProps();
            for (const key of Object.keys(external_types_js_namespaceObject.PostHogPersistedProperty))if (!allPropertiesToKeep.includes(external_types_js_namespaceObject.PostHogPersistedProperty[key])) this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty[key], null);
            this.reloadFeatureFlags();
        });
    }
    getCommonEventProperties() {
        const featureFlags = this.getFeatureFlags();
        const featureVariantProperties = {};
        if (featureFlags) for (const [feature, variant] of Object.entries(featureFlags))featureVariantProperties[`$feature/${feature}`] = variant;
        return {
            ...(0, external_posthog_core_stateless_js_namespaceObject.maybeAdd)('$active_feature_flags', featureFlags ? Object.keys(featureFlags) : void 0),
            ...featureVariantProperties,
            ...super.getCommonEventProperties()
        };
    }
    enrichProperties(properties) {
        return {
            ...this.props,
            ...this.sessionProps,
            ...properties || {},
            ...this.getCommonEventProperties(),
            $session_id: this.getSessionId()
        };
    }
    getSessionId() {
        if (!this._isInitialized) return '';
        let sessionId = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.SessionId);
        const sessionLastTimestamp = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.SessionLastTimestamp) || 0;
        const sessionStartTimestamp = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.SessionStartTimestamp) || 0;
        const now = Date.now();
        const sessionLastDif = now - sessionLastTimestamp;
        const sessionStartDif = now - sessionStartTimestamp;
        if (!sessionId || sessionLastDif > 1000 * this._sessionExpirationTimeSeconds || sessionStartDif > 1000 * this._sessionMaxLengthSeconds) {
            sessionId = (0, uuidv7_js_namespaceObject.uuidv7)();
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.SessionId, sessionId);
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.SessionStartTimestamp, now);
        }
        this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.SessionLastTimestamp, now);
        return sessionId;
    }
    resetSessionId() {
        this.wrap(()=>{
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.SessionId, null);
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.SessionLastTimestamp, null);
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.SessionStartTimestamp, null);
        });
    }
    getAnonymousId() {
        if (!this._isInitialized) return '';
        let anonId = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.AnonymousId);
        if (!anonId) {
            anonId = (0, uuidv7_js_namespaceObject.uuidv7)();
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.AnonymousId, anonId);
        }
        return anonId;
    }
    getDistinctId() {
        if (!this._isInitialized) return '';
        return this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.DistinctId) || this.getAnonymousId();
    }
    registerForSession(properties) {
        this.sessionProps = {
            ...this.sessionProps,
            ...properties
        };
    }
    unregisterForSession(property) {
        delete this.sessionProps[property];
    }
    identify(distinctId, properties, options) {
        this.wrap(()=>{
            const previousDistinctId = this.getDistinctId();
            distinctId = distinctId || previousDistinctId;
            if (properties?.$groups) this.groups(properties.$groups);
            const userPropsOnce = properties?.$set_once;
            delete properties?.$set_once;
            const userProps = properties?.$set || properties;
            const allProperties = this.enrichProperties({
                $anon_distinct_id: this.getAnonymousId(),
                ...(0, external_posthog_core_stateless_js_namespaceObject.maybeAdd)('$set', userProps),
                ...(0, external_posthog_core_stateless_js_namespaceObject.maybeAdd)('$set_once', userPropsOnce)
            });
            if (distinctId !== previousDistinctId) {
                this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.AnonymousId, previousDistinctId);
                this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.DistinctId, distinctId);
                this.reloadFeatureFlags();
            }
            super.identifyStateless(distinctId, allProperties, options);
        });
    }
    capture(event, properties, options) {
        this.wrap(()=>{
            const distinctId = this.getDistinctId();
            if (properties?.$groups) this.groups(properties.$groups);
            const allProperties = this.enrichProperties(properties);
            super.captureStateless(distinctId, event, allProperties, options);
        });
    }
    alias(alias) {
        this.wrap(()=>{
            const distinctId = this.getDistinctId();
            const allProperties = this.enrichProperties({});
            super.aliasStateless(alias, distinctId, allProperties);
        });
    }
    autocapture(eventType, elements, properties = {}, options) {
        this.wrap(()=>{
            const distinctId = this.getDistinctId();
            const payload = {
                distinct_id: distinctId,
                event: '$autocapture',
                properties: {
                    ...this.enrichProperties(properties),
                    $event_type: eventType,
                    $elements: elements
                }
            };
            this.enqueue('autocapture', payload, options);
        });
    }
    groups(groups) {
        this.wrap(()=>{
            const existingGroups = this.props.$groups || {};
            this.register({
                $groups: {
                    ...existingGroups,
                    ...groups
                }
            });
            if (Object.keys(groups).find((type)=>existingGroups[type] !== groups[type])) this.reloadFeatureFlags();
        });
    }
    group(groupType, groupKey, groupProperties, options) {
        this.wrap(()=>{
            this.groups({
                [groupType]: groupKey
            });
            if (groupProperties) this.groupIdentify(groupType, groupKey, groupProperties, options);
        });
    }
    groupIdentify(groupType, groupKey, groupProperties, options) {
        this.wrap(()=>{
            const distinctId = this.getDistinctId();
            const eventProperties = this.enrichProperties({});
            super.groupIdentifyStateless(groupType, groupKey, groupProperties, options, distinctId, eventProperties);
        });
    }
    setPersonPropertiesForFlags(properties) {
        this.wrap(()=>{
            const existingProperties = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.PersonProperties) || {};
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.PersonProperties, {
                ...existingProperties,
                ...properties
            });
        });
    }
    resetPersonPropertiesForFlags() {
        this.wrap(()=>{
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.PersonProperties, null);
        });
    }
    setGroupPropertiesForFlags(properties) {
        this.wrap(()=>{
            const existingProperties = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.GroupProperties) || {};
            if (0 !== Object.keys(existingProperties).length) Object.keys(existingProperties).forEach((groupType)=>{
                existingProperties[groupType] = {
                    ...existingProperties[groupType],
                    ...properties[groupType]
                };
                delete properties[groupType];
            });
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.GroupProperties, {
                ...existingProperties,
                ...properties
            });
        });
    }
    resetGroupPropertiesForFlags() {
        this.wrap(()=>{
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.GroupProperties, null);
        });
    }
    async remoteConfigAsync() {
        await this._initPromise;
        if (this._remoteConfigResponsePromise) return this._remoteConfigResponsePromise;
        return this._remoteConfigAsync();
    }
    async flagsAsync(sendAnonDistinctId = true) {
        await this._initPromise;
        if (this._flagsResponsePromise) return this._flagsResponsePromise;
        return this._flagsAsync(sendAnonDistinctId);
    }
    cacheSessionReplay(source, response) {
        const sessionReplay = response?.sessionRecording;
        if (sessionReplay) {
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.SessionReplay, sessionReplay);
            this._logger.info(`Session replay config from ${source}: `, JSON.stringify(sessionReplay));
        } else if ('boolean' == typeof sessionReplay && false === sessionReplay) {
            this._logger.info(`Session replay config from ${source} disabled.`);
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.SessionReplay, null);
        }
    }
    async _remoteConfigAsync() {
        this._remoteConfigResponsePromise = this._initPromise.then(()=>{
            let remoteConfig = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.RemoteConfig);
            this._logger.info('Cached remote config: ', JSON.stringify(remoteConfig));
            return super.getRemoteConfig().then((response)=>{
                if (response) {
                    const remoteConfigWithoutSurveys = {
                        ...response
                    };
                    delete remoteConfigWithoutSurveys.surveys;
                    this._logger.info('Fetched remote config: ', JSON.stringify(remoteConfigWithoutSurveys));
                    if (false === this.disableSurveys) {
                        const surveys = response.surveys;
                        let hasSurveys = true;
                        if (Array.isArray(surveys)) this._logger.info('Surveys fetched from remote config: ', JSON.stringify(surveys));
                        else {
                            this._logger.info('There are no surveys.');
                            hasSurveys = false;
                        }
                        if (hasSurveys) this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.Surveys, surveys);
                        else this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.Surveys, null);
                    } else this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.Surveys, null);
                    this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.RemoteConfig, remoteConfigWithoutSurveys);
                    this.cacheSessionReplay('remote config', response);
                    if (false === response.hasFeatureFlags) {
                        this.setKnownFeatureFlagDetails({
                            flags: {}
                        });
                        this._logger.warn('Remote config has no feature flags, will not load feature flags.');
                    } else if (false !== this.preloadFeatureFlags) this.reloadFeatureFlags();
                    if (!response.supportedCompression?.includes(external_types_js_namespaceObject.Compression.GZipJS)) this.disableCompression = true;
                    remoteConfig = response;
                }
                return remoteConfig;
            });
        }).finally(()=>{
            this._remoteConfigResponsePromise = void 0;
        });
        return this._remoteConfigResponsePromise;
    }
    async _flagsAsync(sendAnonDistinctId = true) {
        this._flagsResponsePromise = this._initPromise.then(async ()=>{
            const distinctId = this.getDistinctId();
            const groups = this.props.$groups || {};
            const personProperties = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.PersonProperties) || {};
            const groupProperties = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.GroupProperties) || {};
            const extraProperties = {
                $anon_distinct_id: sendAnonDistinctId ? this.getAnonymousId() : void 0
            };
            const res = await super.getFlags(distinctId, groups, personProperties, groupProperties, extraProperties);
            if (res?.quotaLimited?.includes(external_posthog_core_stateless_js_namespaceObject.QuotaLimitedFeature.FeatureFlags)) {
                this.setKnownFeatureFlagDetails(null);
                console.warn('[FEATURE FLAGS] Feature flags quota limit exceeded - unsetting all flags. Learn more about billing limits at https://posthog.com/docs/billing/limits-alerts');
                return res;
            }
            if (res?.featureFlags) {
                if (this.sendFeatureFlagEvent) this.flagCallReported = {};
                let newFeatureFlagDetails = res;
                if (res.errorsWhileComputingFlags) {
                    const currentFlagDetails = this.getKnownFeatureFlagDetails();
                    this._logger.info('Cached feature flags: ', JSON.stringify(currentFlagDetails));
                    newFeatureFlagDetails = {
                        ...res,
                        flags: {
                            ...currentFlagDetails?.flags,
                            ...res.flags
                        }
                    };
                }
                this.setKnownFeatureFlagDetails(newFeatureFlagDetails);
                this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.FlagsEndpointWasHit, true);
                this.cacheSessionReplay('flags', res);
            }
            return res;
        }).finally(()=>{
            this._flagsResponsePromise = void 0;
        });
        return this._flagsResponsePromise;
    }
    setKnownFeatureFlagDetails(flagsResponse) {
        this.wrap(()=>{
            this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.FeatureFlagDetails, flagsResponse);
            this._events.emit('featureflags', (0, external_featureFlagUtils_js_namespaceObject.getFlagValuesFromFlags)(flagsResponse?.flags ?? {}));
        });
    }
    getKnownFeatureFlagDetails() {
        const storedDetails = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.FeatureFlagDetails);
        if (!storedDetails) {
            const featureFlags = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.FeatureFlags);
            const featureFlagPayloads = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.FeatureFlagPayloads);
            if (void 0 === featureFlags && void 0 === featureFlagPayloads) return;
            return (0, external_featureFlagUtils_js_namespaceObject.createFlagsResponseFromFlagsAndPayloads)(featureFlags ?? {}, featureFlagPayloads ?? {});
        }
        return (0, external_featureFlagUtils_js_namespaceObject.normalizeFlagsResponse)(storedDetails);
    }
    getKnownFeatureFlags() {
        const featureFlagDetails = this.getKnownFeatureFlagDetails();
        if (!featureFlagDetails) return;
        return (0, external_featureFlagUtils_js_namespaceObject.getFlagValuesFromFlags)(featureFlagDetails.flags);
    }
    getKnownFeatureFlagPayloads() {
        const featureFlagDetails = this.getKnownFeatureFlagDetails();
        if (!featureFlagDetails) return;
        return (0, external_featureFlagUtils_js_namespaceObject.getPayloadsFromFlags)(featureFlagDetails.flags);
    }
    getBootstrappedFeatureFlagDetails() {
        const details = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.BootstrapFeatureFlagDetails);
        if (!details) return;
        return details;
    }
    setBootstrappedFeatureFlagDetails(details) {
        this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.BootstrapFeatureFlagDetails, details);
    }
    getBootstrappedFeatureFlags() {
        const details = this.getBootstrappedFeatureFlagDetails();
        if (!details) return;
        return (0, external_featureFlagUtils_js_namespaceObject.getFlagValuesFromFlags)(details.flags);
    }
    getBootstrappedFeatureFlagPayloads() {
        const details = this.getBootstrappedFeatureFlagDetails();
        if (!details) return;
        return (0, external_featureFlagUtils_js_namespaceObject.getPayloadsFromFlags)(details.flags);
    }
    getFeatureFlag(key) {
        const details = this.getFeatureFlagDetails();
        if (!details) return;
        const featureFlag = details.flags[key];
        let response = (0, external_featureFlagUtils_js_namespaceObject.getFeatureFlagValue)(featureFlag);
        if (void 0 === response) response = false;
        if (this.sendFeatureFlagEvent && !this.flagCallReported[key]) {
            const bootstrappedResponse = this.getBootstrappedFeatureFlags()?.[key];
            const bootstrappedPayload = this.getBootstrappedFeatureFlagPayloads()?.[key];
            this.flagCallReported[key] = true;
            this.capture('$feature_flag_called', {
                $feature_flag: key,
                $feature_flag_response: response,
                ...(0, external_posthog_core_stateless_js_namespaceObject.maybeAdd)('$feature_flag_id', featureFlag?.metadata?.id),
                ...(0, external_posthog_core_stateless_js_namespaceObject.maybeAdd)('$feature_flag_version', featureFlag?.metadata?.version),
                ...(0, external_posthog_core_stateless_js_namespaceObject.maybeAdd)('$feature_flag_reason', featureFlag?.reason?.description ?? featureFlag?.reason?.code),
                ...(0, external_posthog_core_stateless_js_namespaceObject.maybeAdd)('$feature_flag_bootstrapped_response', bootstrappedResponse),
                ...(0, external_posthog_core_stateless_js_namespaceObject.maybeAdd)('$feature_flag_bootstrapped_payload', bootstrappedPayload),
                $used_bootstrap_value: !this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.FlagsEndpointWasHit),
                ...(0, external_posthog_core_stateless_js_namespaceObject.maybeAdd)('$feature_flag_request_id', details.requestId)
            });
        }
        return response;
    }
    getFeatureFlagPayload(key) {
        const payloads = this.getFeatureFlagPayloads();
        if (!payloads) return;
        const response = payloads[key];
        if (void 0 === response) return null;
        return response;
    }
    getFeatureFlagPayloads() {
        return this.getFeatureFlagDetails()?.featureFlagPayloads;
    }
    getFeatureFlags() {
        return this.getFeatureFlagDetails()?.featureFlags;
    }
    getFeatureFlagDetails() {
        let details = this.getKnownFeatureFlagDetails();
        const overriddenFlags = this.getPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.OverrideFeatureFlags);
        if (!overriddenFlags) return details;
        details = details ?? {
            featureFlags: {},
            featureFlagPayloads: {},
            flags: {}
        };
        const flags = details.flags ?? {};
        for(const key in overriddenFlags)if (overriddenFlags[key]) flags[key] = (0, external_featureFlagUtils_js_namespaceObject.updateFlagValue)(flags[key], overriddenFlags[key]);
        else delete flags[key];
        const result = {
            ...details,
            flags
        };
        return (0, external_featureFlagUtils_js_namespaceObject.normalizeFlagsResponse)(result);
    }
    getFeatureFlagsAndPayloads() {
        const flags = this.getFeatureFlags();
        const payloads = this.getFeatureFlagPayloads();
        return {
            flags,
            payloads
        };
    }
    isFeatureEnabled(key) {
        const response = this.getFeatureFlag(key);
        if (void 0 === response) return;
        return !!response;
    }
    reloadFeatureFlags(options) {
        this.flagsAsync(true).then((res)=>{
            options?.cb?.(void 0, res?.featureFlags);
        }).catch((e)=>{
            options?.cb?.(e, void 0);
            if (!options?.cb) this._logger.info('Error reloading feature flags', e);
        });
    }
    async reloadRemoteConfigAsync() {
        return await this.remoteConfigAsync();
    }
    async reloadFeatureFlagsAsync(sendAnonDistinctId) {
        return (await this.flagsAsync(sendAnonDistinctId ?? true))?.featureFlags;
    }
    onFeatureFlags(cb) {
        return this.on('featureflags', async ()=>{
            const flags = this.getFeatureFlags();
            if (flags) cb(flags);
        });
    }
    onFeatureFlag(key, cb) {
        return this.on('featureflags', async ()=>{
            const flagResponse = this.getFeatureFlag(key);
            if (void 0 !== flagResponse) cb(flagResponse);
        });
    }
    async overrideFeatureFlag(flags) {
        this.wrap(()=>{
            if (null === flags) return this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.OverrideFeatureFlags, null);
            return this.setPersistedProperty(external_types_js_namespaceObject.PostHogPersistedProperty.OverrideFeatureFlags, flags);
        });
    }
    captureException(error, additionalProperties) {
        const properties = {
            $exception_level: 'error',
            $exception_list: [
                {
                    type: (0, index_js_namespaceObject.isPlainError)(error) ? error.name : 'Error',
                    value: (0, index_js_namespaceObject.isPlainError)(error) ? error.message : error,
                    mechanism: {
                        handled: true,
                        synthetic: false
                    }
                }
            ],
            ...additionalProperties
        };
        this.capture('$exception', properties);
    }
    captureTraceFeedback(traceId, userFeedback) {
        this.capture('$ai_feedback', {
            $ai_feedback_text: userFeedback,
            $ai_trace_id: String(traceId)
        });
    }
    captureTraceMetric(traceId, metricName, metricValue) {
        this.capture('$ai_metric', {
            $ai_metric_name: metricName,
            $ai_metric_value: String(metricValue),
            $ai_trace_id: String(traceId)
        });
    }
}
exports.PostHogCore = __webpack_exports__.PostHogCore;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "PostHogCore"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
