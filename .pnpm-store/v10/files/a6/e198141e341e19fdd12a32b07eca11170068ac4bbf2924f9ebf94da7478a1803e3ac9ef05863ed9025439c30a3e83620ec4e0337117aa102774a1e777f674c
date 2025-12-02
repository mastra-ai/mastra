import type { MessageShape } from "./types.js";
import { type DescMessage } from "./descriptors.js";
import type { Registry } from "./registry.js";
interface EqualsOptions {
    /**
     * A registry to look up extensions, and messages packed in Any.
     *
     * @private Experimental API, does not follow semantic versioning.
     */
    registry: Registry;
    /**
     * Unpack google.protobuf.Any before comparing.
     * If a type is not in the registry, comparison falls back to comparing the
     * fields of Any.
     *
     * @private Experimental API, does not follow semantic versioning.
     */
    unpackAny?: boolean;
    /**
     * Consider extensions when comparing.
     *
     * @private Experimental API, does not follow semantic versioning.
     */
    extensions?: boolean;
    /**
     * Consider unknown fields when comparing.
     * The registry is used to distinguish between extensions, and unknown fields
     * caused by schema changes.
     *
     * @private Experimental API, does not follow semantic versioning.
     */
    unknown?: boolean;
}
/**
 * Compare two messages of the same type.
 *
 * Note that this function disregards extensions and unknown fields, and that
 * NaN is not equal NaN, following the IEEE standard.
 */
export declare function equals<Desc extends DescMessage>(schema: Desc, a: MessageShape<Desc>, b: MessageShape<Desc>, options?: EqualsOptions): boolean;
export {};
