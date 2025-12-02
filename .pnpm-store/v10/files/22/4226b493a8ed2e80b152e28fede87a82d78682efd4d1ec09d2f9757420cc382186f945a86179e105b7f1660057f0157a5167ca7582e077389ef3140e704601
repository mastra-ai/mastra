import { CppProtocolSubdocOpcode } from './binding';
/**
 * Represents a macro that can be passed to a lookup-in operation to
 * fetch special values such as the expiry, cas, etc...
 *
 * @category Key-Value
 */
export declare class LookupInMacro {
    /**
     * @internal
     */
    _value: string;
    constructor(value: string);
    /**
     * A macro which references the entirety of the document meta-data.
     */
    static get Document(): LookupInMacro;
    /**
     * A macro which references the expiry of a document.
     */
    static get Expiry(): LookupInMacro;
    /**
     * A macro which references the cas of a document.
     */
    static get Cas(): LookupInMacro;
    /**
     * A macro which references the seqno of a document.
     */
    static get SeqNo(): LookupInMacro;
    /**
     * A macro which references the last modified time of a document.
     */
    static get LastModified(): LookupInMacro;
    /**
     * A macro which references the deletion state of a document.  This
     * only makes sense to use in concert with the internal AccessDeleted
     * flags, which are internal.
     */
    static get IsDeleted(): LookupInMacro;
    /**
     * A macro which references the size of a document, expressed in bytes.
     */
    static get ValueSizeBytes(): LookupInMacro;
    /**
     * A macro which references the revision id of a document.
     */
    static get RevId(): LookupInMacro;
}
/**
 * Represents a macro that can be passed to a mutate-in operation to
 * write special values such as the expiry, cas, etc...
 *
 * @category Key-Value
 */
export declare class MutateInMacro {
    /**
     * @internal
     */
    _value: string;
    constructor(value: string);
    /**
     * A macro which references the cas of a document.
     */
    static get Cas(): MutateInMacro;
    /**
     * A macro which references the seqno of a document.
     */
    static get SeqNo(): MutateInMacro;
    /**
     * A macro which references the crc32 of the value of a document.
     */
    static get ValueCrc32c(): MutateInMacro;
}
/**
 * Represents a sub-operation to perform within a lookup-in operation.
 *
 * @category Key-Value
 */
export declare class LookupInSpec {
    /**
     * BUG(JSCBC-756): Previously provided access to the expiry macro for a
     * lookup-in operation.
     *
     * @deprecated Use {@link LookupInMacro.Expiry} instead.
     */
    static get Expiry(): LookupInMacro;
    /**
     * @internal
     */
    _op: CppProtocolSubdocOpcode;
    /**
     * @internal
     */
    _path: string;
    /**
     * @internal
     */
    _flags: number;
    private constructor();
    private static _create;
    /**
     * Creates a LookupInSpec for fetching a field from the document.
     *
     * @param path The path to the field.
     * @param options Optional parameters for this operation.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static get(path: string | LookupInMacro, options?: {
        xattr?: boolean;
    }): LookupInSpec;
    /**
     * Returns whether a specific field exists in the document.
     *
     * @param path The path to the field.
     * @param options Optional parameters for this operation.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static exists(path: string | LookupInMacro, options?: {
        xattr?: boolean;
    }): LookupInSpec;
    /**
     * Returns the number of elements in the array reference by the path.
     *
     * @param path The path to the field.
     * @param options Optional parameters for this operation.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static count(path: string | LookupInMacro, options?: {
        xattr?: boolean;
    }): LookupInSpec;
}
/**
 * Represents a sub-operation to perform within a mutate-in operation.
 *
 * @category Key-Value
 */
export declare class MutateInSpec {
    /**
     * BUG(JSCBC-756): Previously provided access to the document cas mutate
     * macro.
     *
     * @deprecated Use {@link MutateInMacro.Cas} instead.
     */
    static get CasPlaceholder(): MutateInMacro;
    /**
     * @internal
     */
    _op: CppProtocolSubdocOpcode;
    /**
     * @internal
     */
    _path: string;
    /**
     * @internal
     */
    _flags: number;
    /**
     * @internal
     */
    _data: any;
    private constructor();
    private static _create;
    /**
     * Creates a MutateInSpec for inserting a field into the document.  Failing if
     * the field already exists at the specified path.
     *
     * @param path The path to the field.
     * @param value The value to insert.
     * @param options Optional parameters for this operation.
     * @param options.createPath
     * Whether or not the path to the field should be created if it does not
     * already exist.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static insert(path: string, value: any, options?: {
        createPath?: boolean;
        xattr?: boolean;
    }): MutateInSpec;
    /**
     * Creates a MutateInSpec for upserting a field on a document.  This updates
     * the value of the specified field, or creates the field if it does not exits.
     *
     * @param path The path to the field.
     * @param value The value to write.
     * @param options Optional parameters for this operation.
     * @param options.createPath
     * Whether or not the path to the field should be created if it does not
     * already exist.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static upsert(path: string, value: any | MutateInMacro, options?: {
        createPath?: boolean;
        xattr?: boolean;
    }): MutateInSpec;
    /**
     * Creates a MutateInSpec for replacing a field on a document.  This updates
     * the value of the specified field, failing if the field does not exits.
     *
     * @param path The path to the field.
     * @param value The value to write.
     * @param options Optional parameters for this operation.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static replace(path: string, value: any | MutateInMacro, options?: {
        xattr?: boolean;
    }): MutateInSpec;
    /**
     * Creates a MutateInSpec for remove a field from a document.
     *
     * @param path The path to the field.
     * @param options Optional parameters for this operation.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static remove(path: string, options?: {
        xattr?: boolean;
    }): MutateInSpec;
    /**
     * Creates a MutateInSpec for adding a value to the end of an array in a document.
     *
     * @param path The path to the field.
     * @param value The value to add.
     * @param options Optional parameters for this operation.
     * @param options.createPath
     * Whether or not the path to the field should be created if it does not
     * already exist.
     * @param options.multi
     * If set, this enables an array of values to be passed as value, and each
     * element of the passed array is added to the array.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static arrayAppend(path: string, value: any | MutateInMacro, options?: {
        createPath?: boolean;
        multi?: boolean;
        xattr?: boolean;
    }): MutateInSpec;
    /**
     * Creates a MutateInSpec for adding a value to the beginning of an array in a document.
     *
     * @param path The path to the field.
     * @param value The value to add.
     * @param options Optional parameters for this operation.
     * @param options.createPath
     * Whether or not the path to the field should be created if it does not
     * already exist.
     * @param options.multi
     * If set, this enables an array of values to be passed as value, and each
     * element of the passed array is added to the array.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static arrayPrepend(path: string, value: any | MutateInMacro, options?: {
        createPath?: boolean;
        multi?: boolean;
        xattr?: boolean;
    }): MutateInSpec;
    /**
     * Creates a MutateInSpec for adding a value to a specified location in an array in a
     * document.  The path should specify a specific index in the array and the new values
     * are inserted at this location.
     *
     * @param path The path to an element of an array.
     * @param value The value to add.
     * @param options Optional parameters for this operation.
     * @param options.createPath
     * Whether or not the path to the field should be created if it does not
     * already exist.
     * @param options.multi
     * If set, this enables an array of values to be passed as value, and each
     * element of the passed array is added to the array.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static arrayInsert(path: string, value: any | MutateInMacro, options?: {
        createPath?: boolean;
        multi?: boolean;
        xattr?: boolean;
    }): MutateInSpec;
    /**
     * Creates a MutateInSpec for adding unique values to an array in a document.  This
     * operation will only add values if they do not already exist elsewhere in the array.
     *
     * @param path The path to the field.
     * @param value The value to add.
     * @param options Optional parameters for this operation.
     * @param options.createPath
     * Whether or not the path to the field should be created if it does not
     * already exist.
     * @param options.multi
     * If set, this enables an array of values to be passed as value, and each
     * element of the passed array is added to the array.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static arrayAddUnique(path: string, value: any | MutateInMacro, options?: {
        createPath?: boolean;
        multi?: boolean;
        xattr?: boolean;
    }): MutateInSpec;
    /**
     * Creates a MutateInSpec for incrementing the value of a field in a document.
     *
     * @param path The path to the field.
     * @param value The value to add.
     * @param options Optional parameters for this operation.
     * @param options.createPath
     * Whether or not the path to the field should be created if it does not
     * already exist.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static increment(path: string, value: any, options?: {
        createPath?: boolean;
        xattr?: boolean;
    }): MutateInSpec;
    /**
     * Creates a MutateInSpec for decrementing the value of a field in a document.
     *
     * @param path The path to the field.
     * @param value The value to subtract.
     * @param options Optional parameters for this operation.
     * @param options.createPath
     * Whether or not the path to the field should be created if it does not
     * already exist.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static decrement(path: string, value: any, options?: {
        createPath?: boolean;
        xattr?: boolean;
    }): MutateInSpec;
}
