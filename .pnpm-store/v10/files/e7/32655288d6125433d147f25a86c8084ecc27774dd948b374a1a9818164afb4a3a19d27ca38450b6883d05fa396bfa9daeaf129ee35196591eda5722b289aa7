import {
  FeatureFlagDetail,
  FeatureFlagValue,
  JsonType,
  PostHogFlagsResponse,
  PostHogV1FlagsResponse,
  PostHogV2FlagsResponse,
  PostHogFlagsAndPayloadsResponse,
  PartialWithRequired,
  PostHogFeatureFlagsResponse,
} from './types'

export const normalizeFlagsResponse = (
  flagsResponse:
    | PartialWithRequired<PostHogV2FlagsResponse, 'flags'>
    | PartialWithRequired<PostHogV1FlagsResponse, 'featureFlags' | 'featureFlagPayloads'>
): PostHogFeatureFlagsResponse => {
  if ('flags' in flagsResponse) {
    // Convert v2 format to v1 format
    const featureFlags = getFlagValuesFromFlags(flagsResponse.flags)
    const featureFlagPayloads = getPayloadsFromFlags(flagsResponse.flags)

    return {
      ...flagsResponse,
      featureFlags,
      featureFlagPayloads,
    }
  } else {
    // Convert v1 format to v2 format
    const featureFlags = flagsResponse.featureFlags ?? {}
    const featureFlagPayloads = Object.fromEntries(
      Object.entries(flagsResponse.featureFlagPayloads || {}).map(([k, v]) => [k, parsePayload(v)])
    )

    const flags = Object.fromEntries(
      Object.entries(featureFlags).map(([key, value]) => [
        key,
        getFlagDetailFromFlagAndPayload(key, value, featureFlagPayloads[key]),
      ])
    )

    return {
      ...flagsResponse,
      featureFlags,
      featureFlagPayloads,
      flags,
    }
  }
}

function getFlagDetailFromFlagAndPayload(
  key: string,
  value: FeatureFlagValue,
  payload: JsonType | undefined
): FeatureFlagDetail {
  return {
    key: key,
    enabled: typeof value === 'string' ? true : value,
    variant: typeof value === 'string' ? value : undefined,
    reason: undefined,
    metadata: {
      id: undefined,
      version: undefined,
      payload: payload ? JSON.stringify(payload) : undefined,
      description: undefined,
    },
  }
}

/**
 * Get the flag values from the flags v4 response.
 * @param flags - The flags
 * @returns The flag values
 */
export const getFlagValuesFromFlags = (flags: PostHogFlagsResponse['flags']): PostHogFlagsResponse['featureFlags'] => {
  return Object.fromEntries(
    Object.entries(flags ?? {})
      .map(([key, detail]) => [key, getFeatureFlagValue(detail)])
      .filter(([, value]): boolean => value !== undefined)
  )
}

/**
 * Get the payloads from the flags v4 response.
 * @param flags - The flags
 * @returns The payloads
 */
export const getPayloadsFromFlags = (
  flags: PostHogFlagsResponse['flags']
): PostHogFlagsResponse['featureFlagPayloads'] => {
  const safeFlags = flags ?? {}
  return Object.fromEntries(
    Object.keys(safeFlags)
      .filter((flag) => {
        const details = safeFlags[flag]
        return details.enabled && details.metadata && details.metadata.payload !== undefined
      })
      .map((flag) => {
        const payload = safeFlags[flag].metadata?.payload as string
        return [flag, payload ? parsePayload(payload) : undefined]
      })
  )
}

/**
 * Get the flag details from the legacy v1 flags and payloads. As such, it will lack the reason, id, version, and description.
 * @param flagsResponse - The flags response
 * @returns The flag details
 */
export const getFlagDetailsFromFlagsAndPayloads = (
  flagsResponse: PostHogFeatureFlagsResponse
): PostHogFlagsResponse['flags'] => {
  const flags = flagsResponse.featureFlags ?? {}
  const payloads = flagsResponse.featureFlagPayloads ?? {}
  return Object.fromEntries(
    Object.entries(flags).map(([key, value]) => [
      key,
      {
        key: key,
        enabled: typeof value === 'string' ? true : value,
        variant: typeof value === 'string' ? value : undefined,
        reason: undefined,
        metadata: {
          id: undefined,
          version: undefined,
          payload: payloads?.[key] ? JSON.stringify(payloads[key]) : undefined,
          description: undefined,
        },
      },
    ])
  )
}

export const getFeatureFlagValue = (detail: FeatureFlagDetail | undefined): FeatureFlagValue | undefined => {
  return detail === undefined ? undefined : (detail.variant ?? detail.enabled)
}

export const parsePayload = (response: any): any => {
  if (typeof response !== 'string') {
    return response
  }

  try {
    return JSON.parse(response)
  } catch {
    return response
  }
}

/**
 * Get the normalized flag details from the flags and payloads.
 * This is used to convert things like boostrap and stored feature flags and payloads to the v4 format.
 * This helps us ensure backwards compatibility.
 * If a key exists in the featureFlagPayloads that is not in the featureFlags, we treat it as a true feature flag.
 *
 * @param featureFlags - The feature flags
 * @param featureFlagPayloads - The feature flag payloads
 * @returns The normalized flag details
 */
export const createFlagsResponseFromFlagsAndPayloads = (
  featureFlags: PostHogV1FlagsResponse['featureFlags'],
  featureFlagPayloads: PostHogV1FlagsResponse['featureFlagPayloads']
): PostHogFeatureFlagsResponse => {
  // If a feature flag payload key is not in the feature flags, we treat it as true feature flag.
  const allKeys = [...new Set([...Object.keys(featureFlags ?? {}), ...Object.keys(featureFlagPayloads ?? {})])]
  const enabledFlags = allKeys
    .filter((flag) => !!featureFlags[flag] || !!featureFlagPayloads[flag])
    .reduce((res: Record<string, FeatureFlagValue>, key) => ((res[key] = featureFlags[key] ?? true), res), {})

  const flagDetails: PostHogFlagsAndPayloadsResponse = {
    featureFlags: enabledFlags,
    featureFlagPayloads: featureFlagPayloads ?? {},
  }

  return normalizeFlagsResponse(flagDetails as PostHogV1FlagsResponse)
}

export const updateFlagValue = (flag: FeatureFlagDetail, value: FeatureFlagValue): FeatureFlagDetail => {
  return {
    ...flag,
    enabled: getEnabledFromValue(value),
    variant: getVariantFromValue(value),
  }
}

function getEnabledFromValue(value: FeatureFlagValue): boolean {
  return typeof value === 'string' ? true : value
}

function getVariantFromValue(value: FeatureFlagValue): string | undefined {
  return typeof value === 'string' ? value : undefined
}
