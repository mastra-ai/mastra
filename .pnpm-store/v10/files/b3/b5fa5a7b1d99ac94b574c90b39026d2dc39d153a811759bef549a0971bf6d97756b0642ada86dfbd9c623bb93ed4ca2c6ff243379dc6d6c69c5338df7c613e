import { version } from "./version.mjs";
import { PostHogCoreStateless, getFeatureFlagValue, isBlockedUA, isPlainObject, safeSetTimeout } from "@posthog/core";
import { FeatureFlagsPoller, InconclusiveMatchError, RequiresServerEvaluation } from "./extensions/feature-flags/feature-flags.mjs";
import error_tracking from "./extensions/error-tracking/index.mjs";
import { PostHogMemoryStorage } from "./storage-memory.mjs";
const MINIMUM_POLLING_INTERVAL = 100;
const THIRTY_SECONDS = 30000;
const MAX_CACHE_SIZE = 50000;
class PostHogBackendClient extends PostHogCoreStateless {
    constructor(apiKey, options = {}){
        super(apiKey, options), this._memoryStorage = new PostHogMemoryStorage();
        this.options = options;
        this.options.featureFlagsPollingInterval = 'number' == typeof options.featureFlagsPollingInterval ? Math.max(options.featureFlagsPollingInterval, MINIMUM_POLLING_INTERVAL) : THIRTY_SECONDS;
        if (options.personalApiKey) {
            if (options.personalApiKey.includes('phc_')) throw new Error('Your Personal API key is invalid. These keys are prefixed with "phx_" and can be created in PostHog project settings.');
            const shouldEnableLocalEvaluation = false !== options.enableLocalEvaluation;
            if (shouldEnableLocalEvaluation) this.featureFlagsPoller = new FeatureFlagsPoller({
                pollingInterval: this.options.featureFlagsPollingInterval,
                personalApiKey: options.personalApiKey,
                projectApiKey: apiKey,
                timeout: options.requestTimeout ?? 10000,
                host: this.host,
                fetch: options.fetch,
                onError: (err)=>{
                    this._events.emit('error', err);
                },
                onLoad: (count)=>{
                    this._events.emit('localEvaluationFlagsLoaded', count);
                },
                customHeaders: this.getCustomHeaders()
            });
        }
        this.errorTracking = new error_tracking(this, options, this._logger);
        this.distinctIdHasSentFlagCalls = {};
        this.maxCacheSize = options.maxCacheSize || MAX_CACHE_SIZE;
    }
    getPersistedProperty(key) {
        return this._memoryStorage.getProperty(key);
    }
    setPersistedProperty(key, value) {
        return this._memoryStorage.setProperty(key, value);
    }
    fetch(url, options) {
        return this.options.fetch ? this.options.fetch(url, options) : fetch(url, options);
    }
    getLibraryVersion() {
        return version;
    }
    getCustomUserAgent() {
        return `${this.getLibraryId()}/${this.getLibraryVersion()}`;
    }
    enable() {
        return super.optIn();
    }
    disable() {
        return super.optOut();
    }
    debug(enabled = true) {
        super.debug(enabled);
        this.featureFlagsPoller?.debug(enabled);
    }
    capture(props) {
        if ('string' == typeof props) this._logger.warn('Called capture() with a string as the first argument when an object was expected.');
        this.addPendingPromise(this.prepareEventMessage(props).then(({ distinctId, event, properties, options })=>super.captureStateless(distinctId, event, properties, {
                timestamp: options.timestamp,
                disableGeoip: options.disableGeoip,
                uuid: options.uuid
            })).catch((err)=>{
            if (err) console.error(err);
        }));
    }
    async captureImmediate(props) {
        if ('string' == typeof props) this._logger.warn('Called captureImmediate() with a string as the first argument when an object was expected.');
        return this.addPendingPromise(this.prepareEventMessage(props).then(({ distinctId, event, properties, options })=>super.captureStatelessImmediate(distinctId, event, properties, {
                timestamp: options.timestamp,
                disableGeoip: options.disableGeoip,
                uuid: options.uuid
            })).catch((err)=>{
            if (err) console.error(err);
        }));
    }
    identify({ distinctId, properties, disableGeoip }) {
        const userPropsOnce = properties?.$set_once;
        delete properties?.$set_once;
        const userProps = properties?.$set || properties;
        super.identifyStateless(distinctId, {
            $set: userProps,
            $set_once: userPropsOnce
        }, {
            disableGeoip
        });
    }
    async identifyImmediate({ distinctId, properties, disableGeoip }) {
        const userPropsOnce = properties?.$set_once;
        delete properties?.$set_once;
        const userProps = properties?.$set || properties;
        await super.identifyStatelessImmediate(distinctId, {
            $set: userProps,
            $set_once: userPropsOnce
        }, {
            disableGeoip
        });
    }
    alias(data) {
        super.aliasStateless(data.alias, data.distinctId, void 0, {
            disableGeoip: data.disableGeoip
        });
    }
    async aliasImmediate(data) {
        await super.aliasStatelessImmediate(data.alias, data.distinctId, void 0, {
            disableGeoip: data.disableGeoip
        });
    }
    isLocalEvaluationReady() {
        return this.featureFlagsPoller?.isLocalEvaluationReady() ?? false;
    }
    async waitForLocalEvaluationReady(timeoutMs = THIRTY_SECONDS) {
        if (this.isLocalEvaluationReady()) return true;
        if (void 0 === this.featureFlagsPoller) return false;
        return new Promise((resolve)=>{
            const timeout = setTimeout(()=>{
                cleanup();
                resolve(false);
            }, timeoutMs);
            const cleanup = this._events.on('localEvaluationFlagsLoaded', (count)=>{
                clearTimeout(timeout);
                cleanup();
                resolve(count > 0);
            });
        });
    }
    async getFeatureFlag(key, distinctId, options) {
        const { groups, disableGeoip } = options || {};
        let { onlyEvaluateLocally, sendFeatureFlagEvents, personProperties, groupProperties } = options || {};
        const adjustedProperties = this.addLocalPersonAndGroupProperties(distinctId, groups, personProperties, groupProperties);
        personProperties = adjustedProperties.allPersonProperties;
        groupProperties = adjustedProperties.allGroupProperties;
        if (void 0 == onlyEvaluateLocally) onlyEvaluateLocally = false;
        if (void 0 == sendFeatureFlagEvents) sendFeatureFlagEvents = this.options.sendFeatureFlagEvent ?? true;
        let response = await this.featureFlagsPoller?.getFeatureFlag(key, distinctId, groups, personProperties, groupProperties);
        const flagWasLocallyEvaluated = void 0 !== response;
        let requestId;
        let flagDetail;
        if (!flagWasLocallyEvaluated && !onlyEvaluateLocally) {
            const remoteResponse = await super.getFeatureFlagDetailStateless(key, distinctId, groups, personProperties, groupProperties, disableGeoip);
            if (void 0 === remoteResponse) return;
            flagDetail = remoteResponse.response;
            response = getFeatureFlagValue(flagDetail);
            requestId = remoteResponse?.requestId;
        }
        const featureFlagReportedKey = `${key}_${response}`;
        if (sendFeatureFlagEvents && (!(distinctId in this.distinctIdHasSentFlagCalls) || !this.distinctIdHasSentFlagCalls[distinctId].includes(featureFlagReportedKey))) {
            if (Object.keys(this.distinctIdHasSentFlagCalls).length >= this.maxCacheSize) this.distinctIdHasSentFlagCalls = {};
            if (Array.isArray(this.distinctIdHasSentFlagCalls[distinctId])) this.distinctIdHasSentFlagCalls[distinctId].push(featureFlagReportedKey);
            else this.distinctIdHasSentFlagCalls[distinctId] = [
                featureFlagReportedKey
            ];
            this.capture({
                distinctId,
                event: '$feature_flag_called',
                properties: {
                    $feature_flag: key,
                    $feature_flag_response: response,
                    $feature_flag_id: flagDetail?.metadata?.id,
                    $feature_flag_version: flagDetail?.metadata?.version,
                    $feature_flag_reason: flagDetail?.reason?.description ?? flagDetail?.reason?.code,
                    locally_evaluated: flagWasLocallyEvaluated,
                    [`$feature/${key}`]: response,
                    $feature_flag_request_id: requestId
                },
                groups,
                disableGeoip
            });
        }
        return response;
    }
    async getFeatureFlagPayload(key, distinctId, matchValue, options) {
        const { groups, disableGeoip } = options || {};
        let { onlyEvaluateLocally, personProperties, groupProperties } = options || {};
        const adjustedProperties = this.addLocalPersonAndGroupProperties(distinctId, groups, personProperties, groupProperties);
        personProperties = adjustedProperties.allPersonProperties;
        groupProperties = adjustedProperties.allGroupProperties;
        let response;
        const localEvaluationEnabled = void 0 !== this.featureFlagsPoller;
        if (localEvaluationEnabled) {
            await this.featureFlagsPoller?.loadFeatureFlags();
            const flag = this.featureFlagsPoller?.featureFlagsByKey[key];
            if (flag) try {
                const result = await this.featureFlagsPoller?.computeFlagAndPayloadLocally(flag, distinctId, groups, personProperties, groupProperties, matchValue);
                if (result) {
                    matchValue = result.value;
                    response = result.payload;
                }
            } catch (e) {
                if (e instanceof RequiresServerEvaluation || e instanceof InconclusiveMatchError) this._logger?.info(`${e.name} when computing flag locally: ${flag.key}: ${e.message}`);
                else throw e;
            }
        }
        if (void 0 == onlyEvaluateLocally) onlyEvaluateLocally = false;
        const payloadWasLocallyEvaluated = void 0 !== response;
        if (!payloadWasLocallyEvaluated && !onlyEvaluateLocally) response = await super.getFeatureFlagPayloadStateless(key, distinctId, groups, personProperties, groupProperties, disableGeoip);
        return response;
    }
    async getRemoteConfigPayload(flagKey) {
        if (!this.options.personalApiKey) throw new Error('Personal API key is required for remote config payload decryption');
        const response = await this._requestRemoteConfigPayload(flagKey);
        if (!response) return;
        const parsed = await response.json();
        if ('string' == typeof parsed) try {
            return JSON.parse(parsed);
        } catch (e) {}
        return parsed;
    }
    async isFeatureEnabled(key, distinctId, options) {
        const feat = await this.getFeatureFlag(key, distinctId, options);
        if (void 0 === feat) return;
        return !!feat || false;
    }
    async getAllFlags(distinctId, options) {
        const response = await this.getAllFlagsAndPayloads(distinctId, options);
        return response.featureFlags || {};
    }
    async getAllFlagsAndPayloads(distinctId, options) {
        const { groups, disableGeoip, flagKeys } = options || {};
        let { onlyEvaluateLocally, personProperties, groupProperties } = options || {};
        const adjustedProperties = this.addLocalPersonAndGroupProperties(distinctId, groups, personProperties, groupProperties);
        personProperties = adjustedProperties.allPersonProperties;
        groupProperties = adjustedProperties.allGroupProperties;
        if (void 0 == onlyEvaluateLocally) onlyEvaluateLocally = false;
        const localEvaluationResult = await this.featureFlagsPoller?.getAllFlagsAndPayloads(distinctId, groups, personProperties, groupProperties, flagKeys);
        let featureFlags = {};
        let featureFlagPayloads = {};
        let fallbackToFlags = true;
        if (localEvaluationResult) {
            featureFlags = localEvaluationResult.response;
            featureFlagPayloads = localEvaluationResult.payloads;
            fallbackToFlags = localEvaluationResult.fallbackToFlags;
        }
        if (fallbackToFlags && !onlyEvaluateLocally) {
            const remoteEvaluationResult = await super.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties, disableGeoip, flagKeys);
            featureFlags = {
                ...featureFlags,
                ...remoteEvaluationResult.flags || {}
            };
            featureFlagPayloads = {
                ...featureFlagPayloads,
                ...remoteEvaluationResult.payloads || {}
            };
        }
        return {
            featureFlags,
            featureFlagPayloads
        };
    }
    groupIdentify({ groupType, groupKey, properties, distinctId, disableGeoip }) {
        super.groupIdentifyStateless(groupType, groupKey, properties, {
            disableGeoip
        }, distinctId);
    }
    async reloadFeatureFlags() {
        await this.featureFlagsPoller?.loadFeatureFlags(true);
    }
    async _shutdown(shutdownTimeoutMs) {
        this.featureFlagsPoller?.stopPoller();
        this.errorTracking.shutdown();
        return super._shutdown(shutdownTimeoutMs);
    }
    async _requestRemoteConfigPayload(flagKey) {
        if (!this.options.personalApiKey) return;
        const url = `${this.host}/api/projects/@current/feature_flags/${flagKey}/remote_config?token=${encodeURIComponent(this.apiKey)}`;
        const options = {
            method: 'GET',
            headers: {
                ...this.getCustomHeaders(),
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.options.personalApiKey}`
            }
        };
        let abortTimeout = null;
        if (this.options.requestTimeout && 'number' == typeof this.options.requestTimeout) {
            const controller = new AbortController();
            abortTimeout = safeSetTimeout(()=>{
                controller.abort();
            }, this.options.requestTimeout);
            options.signal = controller.signal;
        }
        try {
            return await this.fetch(url, options);
        } catch (error) {
            this._events.emit('error', error);
            return;
        } finally{
            if (abortTimeout) clearTimeout(abortTimeout);
        }
    }
    extractPropertiesFromEvent(eventProperties, groups) {
        if (!eventProperties) return {
            personProperties: {},
            groupProperties: {}
        };
        const personProperties = {};
        const groupProperties = {};
        for (const [key, value] of Object.entries(eventProperties))if (isPlainObject(value) && groups && key in groups) {
            const groupProps = {};
            for (const [groupKey, groupValue] of Object.entries(value))groupProps[String(groupKey)] = String(groupValue);
            groupProperties[String(key)] = groupProps;
        } else personProperties[String(key)] = String(value);
        return {
            personProperties,
            groupProperties
        };
    }
    async getFeatureFlagsForEvent(distinctId, groups, disableGeoip, sendFeatureFlagsOptions) {
        const finalPersonProperties = sendFeatureFlagsOptions?.personProperties || {};
        const finalGroupProperties = sendFeatureFlagsOptions?.groupProperties || {};
        const flagKeys = sendFeatureFlagsOptions?.flagKeys;
        const onlyEvaluateLocally = sendFeatureFlagsOptions?.onlyEvaluateLocally ?? false;
        if (onlyEvaluateLocally) if (!((this.featureFlagsPoller?.featureFlags?.length || 0) > 0)) return {};
        else {
            const groupsWithStringValues = {};
            for (const [key, value] of Object.entries(groups || {}))groupsWithStringValues[key] = String(value);
            return await this.getAllFlags(distinctId, {
                groups: groupsWithStringValues,
                personProperties: finalPersonProperties,
                groupProperties: finalGroupProperties,
                disableGeoip,
                onlyEvaluateLocally: true,
                flagKeys
            });
        }
        if ((this.featureFlagsPoller?.featureFlags?.length || 0) > 0) {
            const groupsWithStringValues = {};
            for (const [key, value] of Object.entries(groups || {}))groupsWithStringValues[key] = String(value);
            return await this.getAllFlags(distinctId, {
                groups: groupsWithStringValues,
                personProperties: finalPersonProperties,
                groupProperties: finalGroupProperties,
                disableGeoip,
                onlyEvaluateLocally: true,
                flagKeys
            });
        }
        return (await super.getFeatureFlagsStateless(distinctId, groups, finalPersonProperties, finalGroupProperties, disableGeoip)).flags;
    }
    addLocalPersonAndGroupProperties(distinctId, groups, personProperties, groupProperties) {
        const allPersonProperties = {
            distinct_id: distinctId,
            ...personProperties || {}
        };
        const allGroupProperties = {};
        if (groups) for (const groupName of Object.keys(groups))allGroupProperties[groupName] = {
            $group_key: groups[groupName],
            ...groupProperties?.[groupName] || {}
        };
        return {
            allPersonProperties,
            allGroupProperties
        };
    }
    captureException(error, distinctId, additionalProperties) {
        const syntheticException = new Error('PostHog syntheticException');
        this.addPendingPromise(error_tracking.buildEventMessage(error, {
            syntheticException
        }, distinctId, additionalProperties).then((msg)=>this.capture(msg)));
    }
    async captureExceptionImmediate(error, distinctId, additionalProperties) {
        const syntheticException = new Error('PostHog syntheticException');
        this.addPendingPromise(error_tracking.buildEventMessage(error, {
            syntheticException
        }, distinctId, additionalProperties).then((msg)=>this.captureImmediate(msg)));
    }
    async prepareEventMessage(props) {
        const { distinctId, event, properties, groups, sendFeatureFlags, timestamp, disableGeoip, uuid } = props;
        const eventMessage = this._runBeforeSend({
            distinctId,
            event,
            properties,
            groups,
            sendFeatureFlags,
            timestamp,
            disableGeoip,
            uuid
        });
        if (!eventMessage) return Promise.reject(null);
        const eventProperties = await Promise.resolve().then(async ()=>{
            if (sendFeatureFlags) {
                const sendFeatureFlagsOptions = 'object' == typeof sendFeatureFlags ? sendFeatureFlags : void 0;
                return await this.getFeatureFlagsForEvent(distinctId, groups, disableGeoip, sendFeatureFlagsOptions);
            }
            return {};
        }).then((flags)=>{
            const additionalProperties = {};
            if (flags) for (const [feature, variant] of Object.entries(flags))additionalProperties[`$feature/${feature}`] = variant;
            const activeFlags = Object.keys(flags || {}).filter((flag)=>flags?.[flag] !== false).sort();
            if (activeFlags.length > 0) additionalProperties['$active_feature_flags'] = activeFlags;
            return additionalProperties;
        }).catch(()=>({})).then((additionalProperties)=>{
            const props = {
                ...additionalProperties,
                ...eventMessage.properties || {},
                $groups: eventMessage.groups || groups
            };
            return props;
        });
        if ('$pageview' === eventMessage.event && this.options.__preview_capture_bot_pageviews && 'string' == typeof eventProperties.$raw_user_agent) {
            if (isBlockedUA(eventProperties.$raw_user_agent, this.options.custom_blocked_useragents || [])) {
                eventMessage.event = '$bot_pageview';
                eventProperties.$browser_type = 'bot';
            }
        }
        return {
            distinctId: eventMessage.distinctId,
            event: eventMessage.event,
            properties: eventProperties,
            options: {
                timestamp: eventMessage.timestamp,
                disableGeoip: eventMessage.disableGeoip,
                uuid: eventMessage.uuid
            }
        };
    }
    _runBeforeSend(eventMessage) {
        const beforeSend = this.options.before_send;
        if (!beforeSend) return eventMessage;
        const fns = Array.isArray(beforeSend) ? beforeSend : [
            beforeSend
        ];
        let result = eventMessage;
        for (const fn of fns){
            result = fn(result);
            if (!result) {
                this._logger.info(`Event '${eventMessage.event}' was rejected in beforeSend function`);
                return null;
            }
            if (!result.properties || 0 === Object.keys(result.properties).length) {
                const message = `Event '${result.event}' has no properties after beforeSend function, this is likely an error.`;
                this._logger.warn(message);
            }
        }
        return result;
    }
}
export { PostHogBackendClient };
