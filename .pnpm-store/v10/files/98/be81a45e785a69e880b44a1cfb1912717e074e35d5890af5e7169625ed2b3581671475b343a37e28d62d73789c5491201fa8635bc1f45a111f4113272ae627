import { type DescField, type DescMessage } from "../descriptors.js";
import type { MessageShape } from "../types.js";
import type { ReflectList, ReflectMap, ReflectMessage } from "./reflect-types.js";
/**
 * Create a ReflectMessage.
 */
export declare function reflect<Desc extends DescMessage>(messageDesc: Desc, message?: MessageShape<Desc>, 
/**
 * By default, field values are validated when setting them. For example,
 * a value for an uint32 field must be a ECMAScript Number >= 0.
 *
 * When field values are trusted, performance can be improved by disabling
 * checks.
 */
check?: boolean): ReflectMessage;
/**
 * Create a ReflectList.
 */
export declare function reflectList<V>(field: DescField & {
    fieldKind: "list";
}, unsafeInput?: unknown[], 
/**
 * By default, field values are validated when setting them. For example,
 * a value for an uint32 field must be a ECMAScript Number >= 0.
 *
 * When field values are trusted, performance can be improved by disabling
 * checks.
 */
check?: boolean): ReflectList<V>;
/**
 * Create a ReflectMap.
 */
export declare function reflectMap<K = unknown, V = unknown>(field: DescField & {
    fieldKind: "map";
}, unsafeInput?: Record<string, unknown>, 
/**
 * By default, field values are validated when setting them. For example,
 * a value for an uint32 field must be a ECMAScript Number >= 0.
 *
 * When field values are trusted, performance can be improved by disabling
 * checks.
 */
check?: boolean): ReflectMap<K, V>;
