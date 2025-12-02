const normalizeFlagsResponse = (flagsResponse)=>{
    if ('flags' in flagsResponse) {
        const featureFlags = getFlagValuesFromFlags(flagsResponse.flags);
        const featureFlagPayloads = getPayloadsFromFlags(flagsResponse.flags);
        return {
            ...flagsResponse,
            featureFlags,
            featureFlagPayloads
        };
    }
    {
        const featureFlags = flagsResponse.featureFlags ?? {};
        const featureFlagPayloads = Object.fromEntries(Object.entries(flagsResponse.featureFlagPayloads || {}).map(([k, v])=>[
                k,
                parsePayload(v)
            ]));
        const flags = Object.fromEntries(Object.entries(featureFlags).map(([key, value])=>[
                key,
                getFlagDetailFromFlagAndPayload(key, value, featureFlagPayloads[key])
            ]));
        return {
            ...flagsResponse,
            featureFlags,
            featureFlagPayloads,
            flags
        };
    }
};
function getFlagDetailFromFlagAndPayload(key, value, payload) {
    return {
        key: key,
        enabled: 'string' == typeof value ? true : value,
        variant: 'string' == typeof value ? value : void 0,
        reason: void 0,
        metadata: {
            id: void 0,
            version: void 0,
            payload: payload ? JSON.stringify(payload) : void 0,
            description: void 0
        }
    };
}
const getFlagValuesFromFlags = (flags)=>Object.fromEntries(Object.entries(flags ?? {}).map(([key, detail])=>[
            key,
            getFeatureFlagValue(detail)
        ]).filter(([, value])=>void 0 !== value));
const getPayloadsFromFlags = (flags)=>{
    const safeFlags = flags ?? {};
    return Object.fromEntries(Object.keys(safeFlags).filter((flag)=>{
        const details = safeFlags[flag];
        return details.enabled && details.metadata && void 0 !== details.metadata.payload;
    }).map((flag)=>{
        const payload = safeFlags[flag].metadata?.payload;
        return [
            flag,
            payload ? parsePayload(payload) : void 0
        ];
    }));
};
const getFlagDetailsFromFlagsAndPayloads = (flagsResponse)=>{
    const flags = flagsResponse.featureFlags ?? {};
    const payloads = flagsResponse.featureFlagPayloads ?? {};
    return Object.fromEntries(Object.entries(flags).map(([key, value])=>[
            key,
            {
                key: key,
                enabled: 'string' == typeof value ? true : value,
                variant: 'string' == typeof value ? value : void 0,
                reason: void 0,
                metadata: {
                    id: void 0,
                    version: void 0,
                    payload: payloads?.[key] ? JSON.stringify(payloads[key]) : void 0,
                    description: void 0
                }
            }
        ]));
};
const getFeatureFlagValue = (detail)=>void 0 === detail ? void 0 : detail.variant ?? detail.enabled;
const parsePayload = (response)=>{
    if ('string' != typeof response) return response;
    try {
        return JSON.parse(response);
    } catch  {
        return response;
    }
};
const createFlagsResponseFromFlagsAndPayloads = (featureFlags, featureFlagPayloads)=>{
    const allKeys = [
        ...new Set([
            ...Object.keys(featureFlags ?? {}),
            ...Object.keys(featureFlagPayloads ?? {})
        ])
    ];
    const enabledFlags = allKeys.filter((flag)=>!!featureFlags[flag] || !!featureFlagPayloads[flag]).reduce((res, key)=>(res[key] = featureFlags[key] ?? true, res), {});
    const flagDetails = {
        featureFlags: enabledFlags,
        featureFlagPayloads: featureFlagPayloads ?? {}
    };
    return normalizeFlagsResponse(flagDetails);
};
const updateFlagValue = (flag, value)=>({
        ...flag,
        enabled: getEnabledFromValue(value),
        variant: getVariantFromValue(value)
    });
function getEnabledFromValue(value) {
    return 'string' == typeof value ? true : value;
}
function getVariantFromValue(value) {
    return 'string' == typeof value ? value : void 0;
}
export { createFlagsResponseFromFlagsAndPayloads, getFeatureFlagValue, getFlagDetailsFromFlagsAndPayloads, getFlagValuesFromFlags, getPayloadsFromFlags, normalizeFlagsResponse, parsePayload, updateFlagValue };
