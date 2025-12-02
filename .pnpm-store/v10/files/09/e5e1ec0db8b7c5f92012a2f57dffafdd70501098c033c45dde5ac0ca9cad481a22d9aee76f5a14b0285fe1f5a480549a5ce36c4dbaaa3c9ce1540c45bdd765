import { createFlagsResponseFromFlagsAndPayloads, getFeatureFlagValue, getFlagValuesFromFlags, getPayloadsFromFlags, normalizeFlagsResponse, updateFlagValue } from "./featureFlagUtils.mjs";
import { Compression, PostHogPersistedProperty } from "./types.mjs";
import { PostHogCoreStateless, QuotaLimitedFeature, maybeAdd } from "./posthog-core-stateless.mjs";
import { uuidv7 } from "./vendor/uuidv7.mjs";
import { isPlainError } from "./utils/index.mjs";
class PostHogCore extends PostHogCoreStateless {
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
            const distinctId = this.getPersistedProperty(PostHogPersistedProperty.DistinctId);
            if (!distinctId) this.setPersistedProperty(PostHogPersistedProperty.DistinctId, bootstrap.distinctId);
        } else {
            const anonymousId = this.getPersistedProperty(PostHogPersistedProperty.AnonymousId);
            if (!anonymousId) this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, bootstrap.distinctId);
        }
        const bootstrapFeatureFlags = bootstrap.featureFlags;
        const bootstrapFeatureFlagPayloads = bootstrap.featureFlagPayloads ?? {};
        if (bootstrapFeatureFlags && Object.keys(bootstrapFeatureFlags).length) {
            const normalizedBootstrapFeatureFlagDetails = createFlagsResponseFromFlagsAndPayloads(bootstrapFeatureFlags, bootstrapFeatureFlagPayloads);
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
                PostHogPersistedProperty.Queue,
                ...propertiesToKeep || []
            ];
            this.clearProps();
            for (const key of Object.keys(PostHogPersistedProperty))if (!allPropertiesToKeep.includes(PostHogPersistedProperty[key])) this.setPersistedProperty(PostHogPersistedProperty[key], null);
            this.reloadFeatureFlags();
        });
    }
    getCommonEventProperties() {
        const featureFlags = this.getFeatureFlags();
        const featureVariantProperties = {};
        if (featureFlags) for (const [feature, variant] of Object.entries(featureFlags))featureVariantProperties[`$feature/${feature}`] = variant;
        return {
            ...maybeAdd('$active_feature_flags', featureFlags ? Object.keys(featureFlags) : void 0),
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
        let sessionId = this.getPersistedProperty(PostHogPersistedProperty.SessionId);
        const sessionLastTimestamp = this.getPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp) || 0;
        const sessionStartTimestamp = this.getPersistedProperty(PostHogPersistedProperty.SessionStartTimestamp) || 0;
        const now = Date.now();
        const sessionLastDif = now - sessionLastTimestamp;
        const sessionStartDif = now - sessionStartTimestamp;
        if (!sessionId || sessionLastDif > 1000 * this._sessionExpirationTimeSeconds || sessionStartDif > 1000 * this._sessionMaxLengthSeconds) {
            sessionId = uuidv7();
            this.setPersistedProperty(PostHogPersistedProperty.SessionId, sessionId);
            this.setPersistedProperty(PostHogPersistedProperty.SessionStartTimestamp, now);
        }
        this.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, now);
        return sessionId;
    }
    resetSessionId() {
        this.wrap(()=>{
            this.setPersistedProperty(PostHogPersistedProperty.SessionId, null);
            this.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, null);
            this.setPersistedProperty(PostHogPersistedProperty.SessionStartTimestamp, null);
        });
    }
    getAnonymousId() {
        if (!this._isInitialized) return '';
        let anonId = this.getPersistedProperty(PostHogPersistedProperty.AnonymousId);
        if (!anonId) {
            anonId = uuidv7();
            this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, anonId);
        }
        return anonId;
    }
    getDistinctId() {
        if (!this._isInitialized) return '';
        return this.getPersistedProperty(PostHogPersistedProperty.DistinctId) || this.getAnonymousId();
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
                ...maybeAdd('$set', userProps),
                ...maybeAdd('$set_once', userPropsOnce)
            });
            if (distinctId !== previousDistinctId) {
                this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, previousDistinctId);
                this.setPersistedProperty(PostHogPersistedProperty.DistinctId, distinctId);
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
            const existingProperties = this.getPersistedProperty(PostHogPersistedProperty.PersonProperties) || {};
            this.setPersistedProperty(PostHogPersistedProperty.PersonProperties, {
                ...existingProperties,
                ...properties
            });
        });
    }
    resetPersonPropertiesForFlags() {
        this.wrap(()=>{
            this.setPersistedProperty(PostHogPersistedProperty.PersonProperties, null);
        });
    }
    setGroupPropertiesForFlags(properties) {
        this.wrap(()=>{
            const existingProperties = this.getPersistedProperty(PostHogPersistedProperty.GroupProperties) || {};
            if (0 !== Object.keys(existingProperties).length) Object.keys(existingProperties).forEach((groupType)=>{
                existingProperties[groupType] = {
                    ...existingProperties[groupType],
                    ...properties[groupType]
                };
                delete properties[groupType];
            });
            this.setPersistedProperty(PostHogPersistedProperty.GroupProperties, {
                ...existingProperties,
                ...properties
            });
        });
    }
    resetGroupPropertiesForFlags() {
        this.wrap(()=>{
            this.setPersistedProperty(PostHogPersistedProperty.GroupProperties, null);
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
            this.setPersistedProperty(PostHogPersistedProperty.SessionReplay, sessionReplay);
            this._logger.info(`Session replay config from ${source}: `, JSON.stringify(sessionReplay));
        } else if ('boolean' == typeof sessionReplay && false === sessionReplay) {
            this._logger.info(`Session replay config from ${source} disabled.`);
            this.setPersistedProperty(PostHogPersistedProperty.SessionReplay, null);
        }
    }
    async _remoteConfigAsync() {
        this._remoteConfigResponsePromise = this._initPromise.then(()=>{
            let remoteConfig = this.getPersistedProperty(PostHogPersistedProperty.RemoteConfig);
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
                        if (hasSurveys) this.setPersistedProperty(PostHogPersistedProperty.Surveys, surveys);
                        else this.setPersistedProperty(PostHogPersistedProperty.Surveys, null);
                    } else this.setPersistedProperty(PostHogPersistedProperty.Surveys, null);
                    this.setPersistedProperty(PostHogPersistedProperty.RemoteConfig, remoteConfigWithoutSurveys);
                    this.cacheSessionReplay('remote config', response);
                    if (false === response.hasFeatureFlags) {
                        this.setKnownFeatureFlagDetails({
                            flags: {}
                        });
                        this._logger.warn('Remote config has no feature flags, will not load feature flags.');
                    } else if (false !== this.preloadFeatureFlags) this.reloadFeatureFlags();
                    if (!response.supportedCompression?.includes(Compression.GZipJS)) this.disableCompression = true;
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
            const personProperties = this.getPersistedProperty(PostHogPersistedProperty.PersonProperties) || {};
            const groupProperties = this.getPersistedProperty(PostHogPersistedProperty.GroupProperties) || {};
            const extraProperties = {
                $anon_distinct_id: sendAnonDistinctId ? this.getAnonymousId() : void 0
            };
            const res = await super.getFlags(distinctId, groups, personProperties, groupProperties, extraProperties);
            if (res?.quotaLimited?.includes(QuotaLimitedFeature.FeatureFlags)) {
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
                this.setPersistedProperty(PostHogPersistedProperty.FlagsEndpointWasHit, true);
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
            this.setPersistedProperty(PostHogPersistedProperty.FeatureFlagDetails, flagsResponse);
            this._events.emit('featureflags', getFlagValuesFromFlags(flagsResponse?.flags ?? {}));
        });
    }
    getKnownFeatureFlagDetails() {
        const storedDetails = this.getPersistedProperty(PostHogPersistedProperty.FeatureFlagDetails);
        if (!storedDetails) {
            const featureFlags = this.getPersistedProperty(PostHogPersistedProperty.FeatureFlags);
            const featureFlagPayloads = this.getPersistedProperty(PostHogPersistedProperty.FeatureFlagPayloads);
            if (void 0 === featureFlags && void 0 === featureFlagPayloads) return;
            return createFlagsResponseFromFlagsAndPayloads(featureFlags ?? {}, featureFlagPayloads ?? {});
        }
        return normalizeFlagsResponse(storedDetails);
    }
    getKnownFeatureFlags() {
        const featureFlagDetails = this.getKnownFeatureFlagDetails();
        if (!featureFlagDetails) return;
        return getFlagValuesFromFlags(featureFlagDetails.flags);
    }
    getKnownFeatureFlagPayloads() {
        const featureFlagDetails = this.getKnownFeatureFlagDetails();
        if (!featureFlagDetails) return;
        return getPayloadsFromFlags(featureFlagDetails.flags);
    }
    getBootstrappedFeatureFlagDetails() {
        const details = this.getPersistedProperty(PostHogPersistedProperty.BootstrapFeatureFlagDetails);
        if (!details) return;
        return details;
    }
    setBootstrappedFeatureFlagDetails(details) {
        this.setPersistedProperty(PostHogPersistedProperty.BootstrapFeatureFlagDetails, details);
    }
    getBootstrappedFeatureFlags() {
        const details = this.getBootstrappedFeatureFlagDetails();
        if (!details) return;
        return getFlagValuesFromFlags(details.flags);
    }
    getBootstrappedFeatureFlagPayloads() {
        const details = this.getBootstrappedFeatureFlagDetails();
        if (!details) return;
        return getPayloadsFromFlags(details.flags);
    }
    getFeatureFlag(key) {
        const details = this.getFeatureFlagDetails();
        if (!details) return;
        const featureFlag = details.flags[key];
        let response = getFeatureFlagValue(featureFlag);
        if (void 0 === response) response = false;
        if (this.sendFeatureFlagEvent && !this.flagCallReported[key]) {
            const bootstrappedResponse = this.getBootstrappedFeatureFlags()?.[key];
            const bootstrappedPayload = this.getBootstrappedFeatureFlagPayloads()?.[key];
            this.flagCallReported[key] = true;
            this.capture('$feature_flag_called', {
                $feature_flag: key,
                $feature_flag_response: response,
                ...maybeAdd('$feature_flag_id', featureFlag?.metadata?.id),
                ...maybeAdd('$feature_flag_version', featureFlag?.metadata?.version),
                ...maybeAdd('$feature_flag_reason', featureFlag?.reason?.description ?? featureFlag?.reason?.code),
                ...maybeAdd('$feature_flag_bootstrapped_response', bootstrappedResponse),
                ...maybeAdd('$feature_flag_bootstrapped_payload', bootstrappedPayload),
                $used_bootstrap_value: !this.getPersistedProperty(PostHogPersistedProperty.FlagsEndpointWasHit),
                ...maybeAdd('$feature_flag_request_id', details.requestId)
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
        const overriddenFlags = this.getPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags);
        if (!overriddenFlags) return details;
        details = details ?? {
            featureFlags: {},
            featureFlagPayloads: {},
            flags: {}
        };
        const flags = details.flags ?? {};
        for(const key in overriddenFlags)if (overriddenFlags[key]) flags[key] = updateFlagValue(flags[key], overriddenFlags[key]);
        else delete flags[key];
        const result = {
            ...details,
            flags
        };
        return normalizeFlagsResponse(result);
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
            if (null === flags) return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, null);
            return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, flags);
        });
    }
    captureException(error, additionalProperties) {
        const properties = {
            $exception_level: 'error',
            $exception_list: [
                {
                    type: isPlainError(error) ? error.name : 'Error',
                    value: isPlainError(error) ? error.message : error,
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
export { PostHogCore };
