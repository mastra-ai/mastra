import { AnyConfig, ConfigExtension, NoInfer } from './types'

/**
 * @param baseConfig Config where other config will be merged into. This object will be mutated.
 * @param configExtension Partial config to merge into the `baseConfig`.
 */
export const mergeConfigs = <ClassGroupIds extends string, ThemeGroupIds extends string = never>(
    baseConfig: AnyConfig,
    {
        cacheSize,
        prefix,
        experimentalParseClassName,
        extend = {},
        override = {},
    }: ConfigExtension<ClassGroupIds, ThemeGroupIds>,
) => {
    overrideProperty(baseConfig, 'cacheSize', cacheSize)
    overrideProperty(baseConfig, 'prefix', prefix)
    overrideProperty(baseConfig, 'experimentalParseClassName', experimentalParseClassName)

    overrideConfigProperties(baseConfig.theme, override.theme)
    overrideConfigProperties(baseConfig.classGroups, override.classGroups)
    overrideConfigProperties(baseConfig.conflictingClassGroups, override.conflictingClassGroups)
    overrideConfigProperties(
        baseConfig.conflictingClassGroupModifiers,
        override.conflictingClassGroupModifiers,
    )
    overrideProperty(baseConfig, 'orderSensitiveModifiers', override.orderSensitiveModifiers)

    mergeConfigProperties(baseConfig.theme, extend.theme)
    mergeConfigProperties(baseConfig.classGroups, extend.classGroups)
    mergeConfigProperties(baseConfig.conflictingClassGroups, extend.conflictingClassGroups)
    mergeConfigProperties(
        baseConfig.conflictingClassGroupModifiers,
        extend.conflictingClassGroupModifiers,
    )
    mergeArrayProperties(baseConfig, extend, 'orderSensitiveModifiers')

    return baseConfig
}

const overrideProperty = <T extends object, K extends keyof T>(
    baseObject: T,
    overrideKey: K,
    overrideValue: T[K] | undefined,
) => {
    if (overrideValue !== undefined) {
        baseObject[overrideKey] = overrideValue
    }
}

const overrideConfigProperties = (
    baseObject: Partial<Record<string, readonly unknown[]>>,
    overrideObject: Partial<Record<string, readonly unknown[]>> | undefined,
) => {
    if (overrideObject) {
        for (const key in overrideObject) {
            overrideProperty(baseObject, key, overrideObject[key])
        }
    }
}

const mergeConfigProperties = (
    baseObject: Partial<Record<string, readonly unknown[]>>,
    mergeObject: Partial<Record<string, readonly unknown[]>> | undefined,
) => {
    if (mergeObject) {
        for (const key in mergeObject) {
            mergeArrayProperties(baseObject, mergeObject, key)
        }
    }
}

const mergeArrayProperties = <Key extends string>(
    baseObject: Partial<Record<NoInfer<Key>, readonly unknown[]>>,
    mergeObject: Partial<Record<NoInfer<Key>, readonly unknown[]>>,
    key: Key,
) => {
    const mergeValue = mergeObject[key]

    if (mergeValue !== undefined) {
        baseObject[key] = baseObject[key] ? baseObject[key].concat(mergeValue) : mergeValue
    }
}
