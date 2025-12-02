"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MutateInSpec = exports.LookupInSpec = exports.MutateInMacro = exports.LookupInMacro = void 0;
const binding_1 = __importDefault(require("./binding"));
/**
 * Represents a macro that can be passed to a lookup-in operation to
 * fetch special values such as the expiry, cas, etc...
 *
 * @category Key-Value
 */
class LookupInMacro {
    constructor(value) {
        this._value = value;
    }
    /**
     * A macro which references the entirety of the document meta-data.
     */
    static get Document() {
        return new LookupInMacro('$document');
    }
    /**
     * A macro which references the expiry of a document.
     */
    static get Expiry() {
        return new LookupInMacro('$document.exptime');
    }
    /**
     * A macro which references the cas of a document.
     */
    static get Cas() {
        return new LookupInMacro('$document.CAS');
    }
    /**
     * A macro which references the seqno of a document.
     */
    static get SeqNo() {
        return new LookupInMacro('$document.seqno');
    }
    /**
     * A macro which references the last modified time of a document.
     */
    static get LastModified() {
        return new LookupInMacro('$document.last_modified');
    }
    /**
     * A macro which references the deletion state of a document.  This
     * only makes sense to use in concert with the internal AccessDeleted
     * flags, which are internal.
     */
    static get IsDeleted() {
        return new LookupInMacro('$document.deleted');
    }
    /**
     * A macro which references the size of a document, expressed in bytes.
     */
    static get ValueSizeBytes() {
        return new LookupInMacro('$document.value_bytes');
    }
    /**
     * A macro which references the revision id of a document.
     */
    static get RevId() {
        return new LookupInMacro('$document.revid');
    }
}
exports.LookupInMacro = LookupInMacro;
/**
 * Represents a macro that can be passed to a mutate-in operation to
 * write special values such as the expiry, cas, etc...
 *
 * @category Key-Value
 */
class MutateInMacro {
    constructor(value) {
        this._value = value;
    }
    /**
     * A macro which references the cas of a document.
     */
    static get Cas() {
        return new MutateInMacro('${Mutation.CAS}');
    }
    /**
     * A macro which references the seqno of a document.
     */
    static get SeqNo() {
        return new MutateInMacro('${Mutation.seqno}');
    }
    /**
     * A macro which references the crc32 of the value of a document.
     */
    static get ValueCrc32c() {
        return new MutateInMacro('${Mutation.value_crc32c}');
    }
}
exports.MutateInMacro = MutateInMacro;
/**
 * Represents a sub-operation to perform within a lookup-in operation.
 *
 * @category Key-Value
 */
class LookupInSpec {
    /**
     * BUG(JSCBC-756): Previously provided access to the expiry macro for a
     * lookup-in operation.
     *
     * @deprecated Use {@link LookupInMacro.Expiry} instead.
     */
    static get Expiry() {
        return LookupInMacro.Expiry;
    }
    constructor(op, path, flags) {
        this._op = op;
        this._path = path;
        this._flags = flags;
    }
    static _create(op, path, options) {
        if (!options) {
            options = {};
        }
        let flags = 0;
        if (path instanceof LookupInMacro) {
            path = path._value;
            flags |=
                binding_1.default.protocol_lookup_in_request_body_lookup_in_specs_path_flag.xattr;
        }
        if (options.xattr) {
            flags |=
                binding_1.default.protocol_lookup_in_request_body_lookup_in_specs_path_flag.xattr;
        }
        return new LookupInSpec(op, path, flags);
    }
    /**
     * Creates a LookupInSpec for fetching a field from the document.
     *
     * @param path The path to the field.
     * @param options Optional parameters for this operation.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static get(path, options) {
        if (!path) {
            return this._create(binding_1.default.protocol_subdoc_opcode.get_doc, '', options);
        }
        return this._create(binding_1.default.protocol_subdoc_opcode.get, path, options);
    }
    /**
     * Returns whether a specific field exists in the document.
     *
     * @param path The path to the field.
     * @param options Optional parameters for this operation.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static exists(path, options) {
        return this._create(binding_1.default.protocol_subdoc_opcode.exists, path, options);
    }
    /**
     * Returns the number of elements in the array reference by the path.
     *
     * @param path The path to the field.
     * @param options Optional parameters for this operation.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static count(path, options) {
        return this._create(binding_1.default.protocol_subdoc_opcode.get_count, path, options);
    }
}
exports.LookupInSpec = LookupInSpec;
/**
 * Represents a sub-operation to perform within a mutate-in operation.
 *
 * @category Key-Value
 */
class MutateInSpec {
    /**
     * BUG(JSCBC-756): Previously provided access to the document cas mutate
     * macro.
     *
     * @deprecated Use {@link MutateInMacro.Cas} instead.
     */
    static get CasPlaceholder() {
        return MutateInMacro.Cas;
    }
    constructor(op, path, flags, data) {
        this._op = op;
        this._path = path;
        this._flags = flags;
        this._data = data;
    }
    static _create(op, path, value, options) {
        if (!options) {
            options = {};
        }
        let flags = 0;
        if (options.createPath) {
            flags |=
                binding_1.default.protocol_mutate_in_request_body_mutate_in_specs_path_flag
                    .create_parents;
        }
        if (value instanceof MutateInMacro) {
            value = value._value;
            flags |=
                binding_1.default.protocol_mutate_in_request_body_mutate_in_specs_path_flag
                    .expand_macros |
                    binding_1.default.protocol_mutate_in_request_body_mutate_in_specs_path_flag.xattr;
        }
        else if (options.xattr) {
            flags |=
                binding_1.default.protocol_mutate_in_request_body_mutate_in_specs_path_flag.xattr;
        }
        if (value !== undefined) {
            // BUG(JSCBC-755): As a solution to our oversight of not accepting arrays of
            // values to various sub-document operations, we have exposed an option instead.
            if (!options.multi) {
                value = JSON.stringify(value);
            }
            else {
                if (!Array.isArray(value)) {
                    throw new Error('value must be an array for a multi operation');
                }
                value = JSON.stringify(value);
                value = value.substr(1, value.length - 2);
            }
        }
        return new MutateInSpec(op, path, flags, value);
    }
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
    static insert(path, value, options) {
        return this._create(binding_1.default.protocol_subdoc_opcode.dict_add, path, value, options);
    }
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
    static upsert(path, value, options) {
        if (!path) {
            return this._create(binding_1.default.protocol_subdoc_opcode.set_doc, '', value, options);
        }
        return this._create(binding_1.default.protocol_subdoc_opcode.dict_upsert, path, value, options);
    }
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
    static replace(path, value, options) {
        return this._create(binding_1.default.protocol_subdoc_opcode.replace, path, value, options);
    }
    /**
     * Creates a MutateInSpec for remove a field from a document.
     *
     * @param path The path to the field.
     * @param options Optional parameters for this operation.
     * @param options.xattr
     * Whether this operation should reference the document body or the extended
     * attributes data for the document.
     */
    static remove(path, options) {
        if (!path) {
            return this._create(binding_1.default.protocol_subdoc_opcode.remove_doc, '', undefined, options);
        }
        return this._create(binding_1.default.protocol_subdoc_opcode.remove, path, undefined, options);
    }
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
    static arrayAppend(path, value, options) {
        return this._create(binding_1.default.protocol_subdoc_opcode.array_push_last, path, value, options);
    }
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
    static arrayPrepend(path, value, options) {
        return this._create(binding_1.default.protocol_subdoc_opcode.array_push_first, path, value, options);
    }
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
    static arrayInsert(path, value, options) {
        return this._create(binding_1.default.protocol_subdoc_opcode.array_insert, path, value, options);
    }
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
    static arrayAddUnique(path, value, options) {
        return this._create(binding_1.default.protocol_subdoc_opcode.array_add_unique, path, value, options);
    }
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
    static increment(path, value, options) {
        return this._create(binding_1.default.protocol_subdoc_opcode.counter, path, +value, options);
    }
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
    static decrement(path, value, options) {
        return this._create(binding_1.default.protocol_subdoc_opcode.counter, path, -1 * +value, options);
    }
}
exports.MutateInSpec = MutateInSpec;
