import { createClassGroupUtils } from './class-group-utils'
import { createLruCache } from './lru-cache'
import { createParseClassName } from './parse-class-name'
import { createSortModifiers } from './sort-modifiers'
import { AnyConfig } from './types'

export type ConfigUtils = ReturnType<typeof createConfigUtils>

export const createConfigUtils = (config: AnyConfig) => ({
    cache: createLruCache<string, string>(config.cacheSize),
    parseClassName: createParseClassName(config),
    sortModifiers: createSortModifiers(config),
    ...createClassGroupUtils(config),
})
