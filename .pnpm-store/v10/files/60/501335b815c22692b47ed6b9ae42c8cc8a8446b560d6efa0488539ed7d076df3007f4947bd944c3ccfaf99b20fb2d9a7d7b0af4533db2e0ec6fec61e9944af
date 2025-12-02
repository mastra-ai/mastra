import { safeSetTimeout } from "@posthog/core";
import { hashSHA1 } from "./crypto.mjs";
const SIXTY_SECONDS = 60000;
const LONG_SCALE = 0xfffffffffffffff;
const NULL_VALUES_ALLOWED_OPERATORS = [
    'is_not'
];
class ClientError extends Error {
    constructor(message){
        super();
        Error.captureStackTrace(this, this.constructor);
        this.name = 'ClientError';
        this.message = message;
        Object.setPrototypeOf(this, ClientError.prototype);
    }
}
class InconclusiveMatchError extends Error {
    constructor(message){
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        Object.setPrototypeOf(this, InconclusiveMatchError.prototype);
    }
}
class RequiresServerEvaluation extends Error {
    constructor(message){
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        Object.setPrototypeOf(this, RequiresServerEvaluation.prototype);
    }
}
class FeatureFlagsPoller {
    constructor({ pollingInterval, personalApiKey, projectApiKey, timeout, host, customHeaders, ...options }){
        this.debugMode = false;
        this.shouldBeginExponentialBackoff = false;
        this.backOffCount = 0;
        this.pollingInterval = pollingInterval;
        this.personalApiKey = personalApiKey;
        this.featureFlags = [];
        this.featureFlagsByKey = {};
        this.groupTypeMapping = {};
        this.cohorts = {};
        this.loadedSuccessfullyOnce = false;
        this.timeout = timeout;
        this.projectApiKey = projectApiKey;
        this.host = host;
        this.poller = void 0;
        this.fetch = options.fetch || fetch;
        this.onError = options.onError;
        this.customHeaders = customHeaders;
        this.onLoad = options.onLoad;
        this.loadFeatureFlags();
    }
    debug(enabled = true) {
        this.debugMode = enabled;
    }
    logMsgIfDebug(fn) {
        if (this.debugMode) fn();
    }
    async getFeatureFlag(key, distinctId, groups = {}, personProperties = {}, groupProperties = {}) {
        await this.loadFeatureFlags();
        let response;
        let featureFlag;
        if (!this.loadedSuccessfullyOnce) return response;
        featureFlag = this.featureFlagsByKey[key];
        if (void 0 !== featureFlag) try {
            const result = await this.computeFlagAndPayloadLocally(featureFlag, distinctId, groups, personProperties, groupProperties);
            response = result.value;
            this.logMsgIfDebug(()=>console.debug(`Successfully computed flag locally: ${key} -> ${response}`));
        } catch (e) {
            if (e instanceof RequiresServerEvaluation || e instanceof InconclusiveMatchError) this.logMsgIfDebug(()=>console.debug(`${e.name} when computing flag locally: ${key}: ${e.message}`));
            else if (e instanceof Error) this.onError?.(new Error(`Error computing flag locally: ${key}: ${e}`));
        }
        return response;
    }
    async getAllFlagsAndPayloads(distinctId, groups = {}, personProperties = {}, groupProperties = {}, flagKeysToExplicitlyEvaluate) {
        await this.loadFeatureFlags();
        const response = {};
        const payloads = {};
        let fallbackToFlags = 0 == this.featureFlags.length;
        const flagsToEvaluate = flagKeysToExplicitlyEvaluate ? flagKeysToExplicitlyEvaluate.map((key)=>this.featureFlagsByKey[key]).filter(Boolean) : this.featureFlags;
        const sharedEvaluationCache = {};
        await Promise.all(flagsToEvaluate.map(async (flag)=>{
            try {
                const { value: matchValue, payload: matchPayload } = await this.computeFlagAndPayloadLocally(flag, distinctId, groups, personProperties, groupProperties, void 0, sharedEvaluationCache);
                response[flag.key] = matchValue;
                if (matchPayload) payloads[flag.key] = matchPayload;
            } catch (e) {
                if (e instanceof RequiresServerEvaluation || e instanceof InconclusiveMatchError) this.logMsgIfDebug(()=>console.debug(`${e.name} when computing flag locally: ${flag.key}: ${e.message}`));
                else if (e instanceof Error) this.onError?.(new Error(`Error computing flag locally: ${flag.key}: ${e}`));
                fallbackToFlags = true;
            }
        }));
        return {
            response,
            payloads,
            fallbackToFlags
        };
    }
    async computeFlagAndPayloadLocally(flag, distinctId, groups = {}, personProperties = {}, groupProperties = {}, matchValue, evaluationCache, skipLoadCheck = false) {
        if (!skipLoadCheck) await this.loadFeatureFlags();
        if (!this.loadedSuccessfullyOnce) return {
            value: false,
            payload: null
        };
        let flagValue;
        flagValue = void 0 !== matchValue ? matchValue : await this.computeFlagValueLocally(flag, distinctId, groups, personProperties, groupProperties, evaluationCache);
        const payload = this.getFeatureFlagPayload(flag.key, flagValue);
        return {
            value: flagValue,
            payload
        };
    }
    async computeFlagValueLocally(flag, distinctId, groups = {}, personProperties = {}, groupProperties = {}, evaluationCache = {}) {
        if (flag.ensure_experience_continuity) throw new InconclusiveMatchError('Flag has experience continuity enabled');
        if (!flag.active) return false;
        const flagFilters = flag.filters || {};
        const aggregation_group_type_index = flagFilters.aggregation_group_type_index;
        if (void 0 == aggregation_group_type_index) return await this.matchFeatureFlagProperties(flag, distinctId, personProperties, evaluationCache);
        {
            const groupName = this.groupTypeMapping[String(aggregation_group_type_index)];
            if (!groupName) {
                this.logMsgIfDebug(()=>console.warn(`[FEATURE FLAGS] Unknown group type index ${aggregation_group_type_index} for feature flag ${flag.key}`));
                throw new InconclusiveMatchError('Flag has unknown group type index');
            }
            if (!(groupName in groups)) {
                this.logMsgIfDebug(()=>console.warn(`[FEATURE FLAGS] Can't compute group feature flag: ${flag.key} without group names passed in`));
                return false;
            }
            const focusedGroupProperties = groupProperties[groupName];
            return await this.matchFeatureFlagProperties(flag, groups[groupName], focusedGroupProperties, evaluationCache);
        }
    }
    getFeatureFlagPayload(key, flagValue) {
        let payload = null;
        if (false !== flagValue && null != flagValue) {
            if ('boolean' == typeof flagValue) payload = this.featureFlagsByKey?.[key]?.filters?.payloads?.[flagValue.toString()] || null;
            else if ('string' == typeof flagValue) payload = this.featureFlagsByKey?.[key]?.filters?.payloads?.[flagValue] || null;
            if (null != payload) {
                if ('object' == typeof payload) return payload;
                if ('string' == typeof payload) try {
                    return JSON.parse(payload);
                } catch  {}
                return payload;
            }
        }
        return null;
    }
    async evaluateFlagDependency(property, distinctId, properties, evaluationCache) {
        const targetFlagKey = property.key;
        if (!this.featureFlagsByKey) throw new InconclusiveMatchError('Feature flags not available for dependency evaluation');
        if (!('dependency_chain' in property)) throw new InconclusiveMatchError(`Flag dependency property for '${targetFlagKey}' is missing required 'dependency_chain' field`);
        const dependencyChain = property.dependency_chain;
        if (!Array.isArray(dependencyChain)) throw new InconclusiveMatchError(`Flag dependency property for '${targetFlagKey}' has an invalid 'dependency_chain' (expected array, got ${typeof dependencyChain})`);
        if (0 === dependencyChain.length) throw new InconclusiveMatchError(`Circular dependency detected for flag '${targetFlagKey}' (empty dependency chain)`);
        for (const depFlagKey of dependencyChain){
            if (!(depFlagKey in evaluationCache)) {
                const depFlag = this.featureFlagsByKey[depFlagKey];
                if (depFlag) if (depFlag.active) try {
                    const depResult = await this.matchFeatureFlagProperties(depFlag, distinctId, properties, evaluationCache);
                    evaluationCache[depFlagKey] = depResult;
                } catch (error) {
                    throw new InconclusiveMatchError(`Error evaluating flag dependency '${depFlagKey}' for flag '${targetFlagKey}': ${error}`);
                }
                else evaluationCache[depFlagKey] = false;
                else throw new InconclusiveMatchError(`Missing flag dependency '${depFlagKey}' for flag '${targetFlagKey}'`);
            }
            const cachedResult = evaluationCache[depFlagKey];
            if (null == cachedResult) throw new InconclusiveMatchError(`Dependency '${depFlagKey}' could not be evaluated`);
        }
        const targetFlagValue = evaluationCache[targetFlagKey];
        return this.flagEvaluatesToExpectedValue(property.value, targetFlagValue);
    }
    flagEvaluatesToExpectedValue(expectedValue, flagValue) {
        if ('boolean' == typeof expectedValue) return expectedValue === flagValue || 'string' == typeof flagValue && '' !== flagValue && true === expectedValue;
        if ('string' == typeof expectedValue) return flagValue === expectedValue;
        return false;
    }
    async matchFeatureFlagProperties(flag, distinctId, properties, evaluationCache = {}) {
        const flagFilters = flag.filters || {};
        const flagConditions = flagFilters.groups || [];
        let isInconclusive = false;
        let result;
        for (const condition of flagConditions)try {
            if (await this.isConditionMatch(flag, distinctId, condition, properties, evaluationCache)) {
                const variantOverride = condition.variant;
                const flagVariants = flagFilters.multivariate?.variants || [];
                result = variantOverride && flagVariants.some((variant)=>variant.key === variantOverride) ? variantOverride : await this.getMatchingVariant(flag, distinctId) || true;
                break;
            }
        } catch (e) {
            if (e instanceof RequiresServerEvaluation) throw e;
            if (e instanceof InconclusiveMatchError) isInconclusive = true;
            else throw e;
        }
        if (void 0 !== result) return result;
        if (isInconclusive) throw new InconclusiveMatchError("Can't determine if feature flag is enabled or not with given properties");
        return false;
    }
    async isConditionMatch(flag, distinctId, condition, properties, evaluationCache = {}) {
        const rolloutPercentage = condition.rollout_percentage;
        const warnFunction = (msg)=>{
            this.logMsgIfDebug(()=>console.warn(msg));
        };
        if ((condition.properties || []).length > 0) {
            for (const prop of condition.properties){
                const propertyType = prop.type;
                let matches = false;
                matches = 'cohort' === propertyType ? matchCohort(prop, properties, this.cohorts, this.debugMode) : 'flag' === propertyType ? await this.evaluateFlagDependency(prop, distinctId, properties, evaluationCache) : matchProperty(prop, properties, warnFunction);
                if (!matches) return false;
            }
            if (void 0 == rolloutPercentage) return true;
        }
        if (void 0 != rolloutPercentage && await _hash(flag.key, distinctId) > rolloutPercentage / 100.0) return false;
        return true;
    }
    async getMatchingVariant(flag, distinctId) {
        const hashValue = await _hash(flag.key, distinctId, 'variant');
        const matchingVariant = this.variantLookupTable(flag).find((variant)=>hashValue >= variant.valueMin && hashValue < variant.valueMax);
        if (matchingVariant) return matchingVariant.key;
    }
    variantLookupTable(flag) {
        const lookupTable = [];
        let valueMin = 0;
        let valueMax = 0;
        const flagFilters = flag.filters || {};
        const multivariates = flagFilters.multivariate?.variants || [];
        multivariates.forEach((variant)=>{
            valueMax = valueMin + variant.rollout_percentage / 100.0;
            lookupTable.push({
                valueMin,
                valueMax,
                key: variant.key
            });
            valueMin = valueMax;
        });
        return lookupTable;
    }
    async loadFeatureFlags(forceReload = false) {
        if (!this.loadedSuccessfullyOnce || forceReload) await this._loadFeatureFlags();
    }
    isLocalEvaluationReady() {
        return (this.loadedSuccessfullyOnce ?? false) && (this.featureFlags?.length ?? 0) > 0;
    }
    getPollingInterval() {
        if (!this.shouldBeginExponentialBackoff) return this.pollingInterval;
        return Math.min(SIXTY_SECONDS, this.pollingInterval * 2 ** this.backOffCount);
    }
    async _loadFeatureFlags() {
        if (this.poller) {
            clearTimeout(this.poller);
            this.poller = void 0;
        }
        this.poller = setTimeout(()=>this._loadFeatureFlags(), this.getPollingInterval());
        try {
            const res = await this._requestFeatureFlagDefinitions();
            if (!res) return;
            switch(res.status){
                case 401:
                    this.shouldBeginExponentialBackoff = true;
                    this.backOffCount += 1;
                    throw new ClientError(`Your project key or personal API key is invalid. Setting next polling interval to ${this.getPollingInterval()}ms. More information: https://posthog.com/docs/api#rate-limiting`);
                case 402:
                    console.warn('[FEATURE FLAGS] Feature flags quota limit exceeded - unsetting all local flags. Learn more about billing limits at https://posthog.com/docs/billing/limits-alerts');
                    this.featureFlags = [];
                    this.featureFlagsByKey = {};
                    this.groupTypeMapping = {};
                    this.cohorts = {};
                    return;
                case 403:
                    this.shouldBeginExponentialBackoff = true;
                    this.backOffCount += 1;
                    throw new ClientError(`Your personal API key does not have permission to fetch feature flag definitions for local evaluation. Setting next polling interval to ${this.getPollingInterval()}ms. Are you sure you're using the correct personal and Project API key pair? More information: https://posthog.com/docs/api/overview`);
                case 429:
                    this.shouldBeginExponentialBackoff = true;
                    this.backOffCount += 1;
                    throw new ClientError(`You are being rate limited. Setting next polling interval to ${this.getPollingInterval()}ms. More information: https://posthog.com/docs/api#rate-limiting`);
                case 200:
                    {
                        const responseJson = await res.json() ?? {};
                        if (!('flags' in responseJson)) return void this.onError?.(new Error(`Invalid response when getting feature flags: ${JSON.stringify(responseJson)}`));
                        this.featureFlags = responseJson.flags ?? [];
                        this.featureFlagsByKey = this.featureFlags.reduce((acc, curr)=>(acc[curr.key] = curr, acc), {});
                        this.groupTypeMapping = responseJson.group_type_mapping || {};
                        this.cohorts = responseJson.cohorts || {};
                        this.loadedSuccessfullyOnce = true;
                        this.shouldBeginExponentialBackoff = false;
                        this.backOffCount = 0;
                        this.onLoad?.(this.featureFlags.length);
                        break;
                    }
                default:
                    return;
            }
        } catch (err) {
            if (err instanceof ClientError) this.onError?.(err);
        }
    }
    getPersonalApiKeyRequestOptions(method = 'GET') {
        return {
            method,
            headers: {
                ...this.customHeaders,
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.personalApiKey}`
            }
        };
    }
    async _requestFeatureFlagDefinitions() {
        const url = `${this.host}/api/feature_flag/local_evaluation?token=${this.projectApiKey}&send_cohorts`;
        const options = this.getPersonalApiKeyRequestOptions();
        let abortTimeout = null;
        if (this.timeout && 'number' == typeof this.timeout) {
            const controller = new AbortController();
            abortTimeout = safeSetTimeout(()=>{
                controller.abort();
            }, this.timeout);
            options.signal = controller.signal;
        }
        try {
            return await this.fetch(url, options);
        } finally{
            clearTimeout(abortTimeout);
        }
    }
    stopPoller() {
        clearTimeout(this.poller);
    }
}
async function _hash(key, distinctId, salt = '') {
    const hashString = await hashSHA1(`${key}.${distinctId}${salt}`);
    return parseInt(hashString.slice(0, 15), 16) / LONG_SCALE;
}
function matchProperty(property, propertyValues, warnFunction) {
    const key = property.key;
    const value = property.value;
    const operator = property.operator || 'exact';
    if (key in propertyValues) {
        if ('is_not_set' === operator) throw new InconclusiveMatchError("Operator is_not_set is not supported");
    } else throw new InconclusiveMatchError(`Property ${key} not found in propertyValues`);
    const overrideValue = propertyValues[key];
    if (null == overrideValue && !NULL_VALUES_ALLOWED_OPERATORS.includes(operator)) {
        if (warnFunction) warnFunction(`Property ${key} cannot have a value of null/undefined with the ${operator} operator`);
        return false;
    }
    function computeExactMatch(value, overrideValue) {
        if (Array.isArray(value)) return value.map((val)=>String(val).toLowerCase()).includes(String(overrideValue).toLowerCase());
        return String(value).toLowerCase() === String(overrideValue).toLowerCase();
    }
    function compare(lhs, rhs, operator) {
        if ('gt' === operator) return lhs > rhs;
        if ('gte' === operator) return lhs >= rhs;
        if ('lt' === operator) return lhs < rhs;
        if ('lte' === operator) return lhs <= rhs;
        throw new Error(`Invalid operator: ${operator}`);
    }
    switch(operator){
        case 'exact':
            return computeExactMatch(value, overrideValue);
        case 'is_not':
            return !computeExactMatch(value, overrideValue);
        case 'is_set':
            return key in propertyValues;
        case 'icontains':
            return String(overrideValue).toLowerCase().includes(String(value).toLowerCase());
        case 'not_icontains':
            return !String(overrideValue).toLowerCase().includes(String(value).toLowerCase());
        case 'regex':
            return isValidRegex(String(value)) && null !== String(overrideValue).match(String(value));
        case 'not_regex':
            return isValidRegex(String(value)) && null === String(overrideValue).match(String(value));
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte':
            {
                let parsedValue = 'number' == typeof value ? value : null;
                if ('string' == typeof value) try {
                    parsedValue = parseFloat(value);
                } catch (err) {}
                if (null == parsedValue || null == overrideValue) return compare(String(overrideValue), String(value), operator);
                if ('string' == typeof overrideValue) return compare(overrideValue, String(value), operator);
                return compare(overrideValue, parsedValue, operator);
            }
        case 'is_date_after':
        case 'is_date_before':
            {
                if ('boolean' == typeof value) throw new InconclusiveMatchError("Date operations cannot be performed on boolean values");
                let parsedDate = relativeDateParseForFeatureFlagMatching(String(value));
                if (null == parsedDate) parsedDate = convertToDateTime(value);
                if (null == parsedDate) throw new InconclusiveMatchError(`Invalid date: ${value}`);
                const overrideDate = convertToDateTime(overrideValue);
                if ([
                    'is_date_before'
                ].includes(operator)) return overrideDate < parsedDate;
                return overrideDate > parsedDate;
            }
        default:
            throw new InconclusiveMatchError(`Unknown operator: ${operator}`);
    }
}
function checkCohortExists(cohortId, cohortProperties) {
    if (!(cohortId in cohortProperties)) throw new RequiresServerEvaluation(`cohort ${cohortId} not found in local cohorts - likely a static cohort that requires server evaluation`);
}
function matchCohort(property, propertyValues, cohortProperties, debugMode = false) {
    const cohortId = String(property.value);
    checkCohortExists(cohortId, cohortProperties);
    const propertyGroup = cohortProperties[cohortId];
    return matchPropertyGroup(propertyGroup, propertyValues, cohortProperties, debugMode);
}
function matchPropertyGroup(propertyGroup, propertyValues, cohortProperties, debugMode = false) {
    if (!propertyGroup) return true;
    const propertyGroupType = propertyGroup.type;
    const properties = propertyGroup.values;
    if (!properties || 0 === properties.length) return true;
    let errorMatchingLocally = false;
    if ('values' in properties[0]) {
        for (const prop of properties)try {
            const matches = matchPropertyGroup(prop, propertyValues, cohortProperties, debugMode);
            if ('AND' === propertyGroupType) {
                if (!matches) return false;
            } else if (matches) return true;
        } catch (err) {
            if (err instanceof RequiresServerEvaluation) throw err;
            if (err instanceof InconclusiveMatchError) {
                if (debugMode) console.debug(`Failed to compute property ${prop} locally: ${err}`);
                errorMatchingLocally = true;
            } else throw err;
        }
        if (errorMatchingLocally) throw new InconclusiveMatchError("Can't match cohort without a given cohort property value");
        return 'AND' === propertyGroupType;
    }
    for (const prop of properties)try {
        let matches;
        if ('cohort' === prop.type) matches = matchCohort(prop, propertyValues, cohortProperties, debugMode);
        else if ('flag' === prop.type) {
            if (debugMode) console.warn(`[FEATURE FLAGS] Flag dependency filters are not supported in local evaluation. Skipping condition with dependency on flag '${prop.key || 'unknown'}'`);
            continue;
        } else matches = matchProperty(prop, propertyValues);
        const negation = prop.negation || false;
        if ('AND' === propertyGroupType) {
            if (!matches && !negation) return false;
            if (matches && negation) return false;
        } else {
            if (matches && !negation) return true;
            if (!matches && negation) return true;
        }
    } catch (err) {
        if (err instanceof RequiresServerEvaluation) throw err;
        if (err instanceof InconclusiveMatchError) {
            if (debugMode) console.debug(`Failed to compute property ${prop} locally: ${err}`);
            errorMatchingLocally = true;
        } else throw err;
    }
    if (errorMatchingLocally) throw new InconclusiveMatchError("can't match cohort without a given cohort property value");
    return 'AND' === propertyGroupType;
}
function isValidRegex(regex) {
    try {
        new RegExp(regex);
        return true;
    } catch (err) {
        return false;
    }
}
function convertToDateTime(value) {
    if (value instanceof Date) return value;
    if ('string' == typeof value || 'number' == typeof value) {
        const date = new Date(value);
        if (!isNaN(date.valueOf())) return date;
        throw new InconclusiveMatchError(`${value} is in an invalid date format`);
    }
    throw new InconclusiveMatchError(`The date provided ${value} must be a string, number, or date object`);
}
function relativeDateParseForFeatureFlagMatching(value) {
    const regex = /^-?(?<number>[0-9]+)(?<interval>[a-z])$/;
    const match = value.match(regex);
    const parsedDt = new Date(new Date().toISOString());
    if (!match) return null;
    {
        if (!match.groups) return null;
        const number = parseInt(match.groups['number']);
        if (number >= 10000) return null;
        const interval = match.groups['interval'];
        if ('h' == interval) parsedDt.setUTCHours(parsedDt.getUTCHours() - number);
        else if ('d' == interval) parsedDt.setUTCDate(parsedDt.getUTCDate() - number);
        else if ('w' == interval) parsedDt.setUTCDate(parsedDt.getUTCDate() - 7 * number);
        else if ('m' == interval) parsedDt.setUTCMonth(parsedDt.getUTCMonth() - number);
        else {
            if ('y' != interval) return null;
            parsedDt.setUTCFullYear(parsedDt.getUTCFullYear() - number);
        }
        return parsedDt;
    }
}
export { ClientError, FeatureFlagsPoller, InconclusiveMatchError, RequiresServerEvaluation, matchProperty, relativeDateParseForFeatureFlagMatching };
