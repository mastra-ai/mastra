import { Expand } from "../type_utils.js";
import { GenericId } from "./index.js";
import { GenericValidator, ObjectType } from "./validator.js";
import { JSONValue } from "./value.js";
type TableNameFromType<T> = T extends GenericId<infer TableName> ? TableName : string;
/**
 * Avoid using `instanceof BaseValidator`; this is inheritence for code reuse
 * not type heirarchy.
 */
declare abstract class BaseValidator<Type, IsOptional extends OptionalProperty = "required", FieldPaths extends string = never> {
    /**
     * Only for TypeScript, the TS type of the JS values validated
     * by this validator.
     */
    readonly type: Type;
    /**
     * Only for TypeScript, if this an Object validator, then
     * this is the TS type of its property names.
     */
    readonly fieldPaths: FieldPaths;
    /**
     * Whether this is an optional Object property value validator.
     */
    readonly isOptional: IsOptional;
    /**
     * Always `"true"`.
     */
    readonly isConvexValidator: true;
    constructor({ isOptional }: {
        isOptional: IsOptional;
    });
}
/**
 * The type of the `v.id(tableName)` validator.
 */
export declare class VId<Type, IsOptional extends OptionalProperty = "required"> extends BaseValidator<Type, IsOptional> {
    /**
     * The name of the table that the validated IDs must belong to.
     */
    readonly tableName: TableNameFromType<Type>;
    /**
     * The kind of validator, `"id"`.
     */
    readonly kind: "id";
    /**
     * Usually you'd use `v.id(tableName)` instead.
     */
    constructor({ isOptional, tableName, }: {
        isOptional: IsOptional;
        tableName: TableNameFromType<Type>;
    });
}
/**
 * The type of the `v.float64()` validator.
 */
export declare class VFloat64<Type = number, IsOptional extends OptionalProperty = "required"> extends BaseValidator<Type, IsOptional> {
    /**
     * The kind of validator, `"float64"`.
     */
    readonly kind: "float64";
}
/**
 * The type of the `v.int64()` validator.
 */
export declare class VInt64<Type = bigint, IsOptional extends OptionalProperty = "required"> extends BaseValidator<Type, IsOptional> {
    /**
     * The kind of validator, `"int64"`.
     */
    readonly kind: "int64";
}
/**
 * The type of the `v.boolean()` validator.
 */
export declare class VBoolean<Type = boolean, IsOptional extends OptionalProperty = "required"> extends BaseValidator<Type, IsOptional> {
    /**
     * The kind of validator, `"boolean"`.
     */
    readonly kind: "boolean";
}
/**
 * The type of the `v.bytes()` validator.
 */
export declare class VBytes<Type = ArrayBuffer, IsOptional extends OptionalProperty = "required"> extends BaseValidator<Type, IsOptional> {
    /**
     * The kind of validator, `"bytes"`.
     */
    readonly kind: "bytes";
}
/**
 * The type of the `v.string()` validator.
 */
export declare class VString<Type = string, IsOptional extends OptionalProperty = "required"> extends BaseValidator<Type, IsOptional> {
    /**
     * The kind of validator, `"string"`.
     */
    readonly kind: "string";
}
/**
 * The type of the `v.null()` validator.
 */
export declare class VNull<Type = null, IsOptional extends OptionalProperty = "required"> extends BaseValidator<Type, IsOptional> {
    /**
     * The kind of validator, `"null"`.
     */
    readonly kind: "null";
}
/**
 * The type of the `v.any()` validator.
 */
export declare class VAny<Type = any, IsOptional extends OptionalProperty = "required", FieldPaths extends string = string> extends BaseValidator<Type, IsOptional, FieldPaths> {
    /**
     * The kind of validator, `"any"`.
     */
    readonly kind: "any";
}
/**
 * The type of the `v.object()` validator.
 */
export declare class VObject<Type, Fields extends Record<string, GenericValidator>, IsOptional extends OptionalProperty = "required", FieldPaths extends string = {
    [Property in keyof Fields]: JoinFieldPaths<Property & string, Fields[Property]["fieldPaths"]> | Property;
}[keyof Fields] & string> extends BaseValidator<Type, IsOptional, FieldPaths> {
    /**
     * An object with the validator for each property.
     */
    readonly fields: Fields;
    /**
     * The kind of validator, `"object"`.
     */
    readonly kind: "object";
    /**
     * Usually you'd use `v.object({ ... })` instead.
     */
    constructor({ isOptional, fields, }: {
        isOptional: IsOptional;
        fields: Fields;
    });
    /**
     * Create a new VObject with the specified fields omitted.
     * @param fields The field names to omit from this VObject.
     */
    omit<K extends keyof Fields & string>(...fields: K[]): VObject<Expand<Omit<Type, K>>, Expand<Omit<Fields, K>>, IsOptional>;
    /**
     * Create a new VObject with only the specified fields.
     * @param fields The field names to pick from this VObject.
     */
    pick<K extends keyof Fields & string>(...fields: K[]): VObject<Expand<Pick<Type, Extract<keyof Type, K>>>, Expand<Pick<Fields, K>>, IsOptional>;
    /**
     * Create a new VObject with all fields marked as optional.
     */
    partial(): VObject<{
        [K in keyof Type]?: Type[K];
    }, {
        [K in keyof Fields]: VOptional<Fields[K]>;
    }, IsOptional>;
    /**
     * Create a new VObject with additional fields merged in.
     * @param fields An object with additional validators to merge into this VObject.
     */
    extend<NewFields extends Record<string, GenericValidator>>(fields: NewFields): VObject<Expand<Type & ObjectType<NewFields>>, Expand<Fields & NewFields>, IsOptional>;
}
/**
 * The type of the `v.literal()` validator.
 */
export declare class VLiteral<Type, IsOptional extends OptionalProperty = "required"> extends BaseValidator<Type, IsOptional> {
    /**
     * The value that the validated values must be equal to.
     */
    readonly value: Type;
    /**
     * The kind of validator, `"literal"`.
     */
    readonly kind: "literal";
    /**
     * Usually you'd use `v.literal(value)` instead.
     */
    constructor({ isOptional, value }: {
        isOptional: IsOptional;
        value: Type;
    });
}
/**
 * The type of the `v.array()` validator.
 */
export declare class VArray<Type, Element extends Validator<any, "required", any>, IsOptional extends OptionalProperty = "required"> extends BaseValidator<Type, IsOptional> {
    /**
     * The validator for the elements of the array.
     */
    readonly element: Element;
    /**
     * The kind of validator, `"array"`.
     */
    readonly kind: "array";
    /**
     * Usually you'd use `v.array(element)` instead.
     */
    constructor({ isOptional, element, }: {
        isOptional: IsOptional;
        element: Element;
    });
}
/**
 * The type of the `v.record()` validator.
 */
export declare class VRecord<Type, Key extends Validator<string, "required", any>, Value extends Validator<any, "required", any>, IsOptional extends OptionalProperty = "required", FieldPaths extends string = string> extends BaseValidator<Type, IsOptional, FieldPaths> {
    /**
     * The validator for the keys of the record.
     */
    readonly key: Key;
    /**
     * The validator for the values of the record.
     */
    readonly value: Value;
    /**
     * The kind of validator, `"record"`.
     */
    readonly kind: "record";
    /**
     * Usually you'd use `v.record(key, value)` instead.
     */
    constructor({ isOptional, key, value, }: {
        isOptional: IsOptional;
        key: Key;
        value: Value;
    });
}
/**
 * The type of the `v.union()` validator.
 */
export declare class VUnion<Type, T extends Validator<any, "required", any>[], IsOptional extends OptionalProperty = "required", FieldPaths extends string = T[number]["fieldPaths"]> extends BaseValidator<Type, IsOptional, FieldPaths> {
    /**
     * The array of validators, one of which must match the value.
     */
    readonly members: T;
    /**
     * The kind of validator, `"union"`.
     */
    readonly kind: "union";
    /**
     * Usually you'd use `v.union(...members)` instead.
     */
    constructor({ isOptional, members }: {
        isOptional: IsOptional;
        members: T;
    });
}
export type VOptional<T extends Validator<any, OptionalProperty, any>> = T extends VId<infer Type, OptionalProperty> ? VId<Type | undefined, "optional"> : T extends VString<infer Type, OptionalProperty> ? VString<Type | undefined, "optional"> : T extends VFloat64<infer Type, OptionalProperty> ? VFloat64<Type | undefined, "optional"> : T extends VInt64<infer Type, OptionalProperty> ? VInt64<Type | undefined, "optional"> : T extends VBoolean<infer Type, OptionalProperty> ? VBoolean<Type | undefined, "optional"> : T extends VNull<infer Type, OptionalProperty> ? VNull<Type | undefined, "optional"> : T extends VAny<infer Type, OptionalProperty> ? VAny<Type | undefined, "optional"> : T extends VLiteral<infer Type, OptionalProperty> ? VLiteral<Type | undefined, "optional"> : T extends VBytes<infer Type, OptionalProperty> ? VBytes<Type | undefined, "optional"> : T extends VObject<infer Type, infer Fields, OptionalProperty, infer FieldPaths> ? VObject<Type | undefined, Fields, "optional", FieldPaths> : T extends VArray<infer Type, infer Element, OptionalProperty> ? VArray<Type | undefined, Element, "optional"> : T extends VRecord<infer Type, infer Key, infer Value, OptionalProperty, infer FieldPaths> ? VRecord<Type | undefined, Key, Value, "optional", FieldPaths> : T extends VUnion<infer Type, infer Members, OptionalProperty, infer FieldPaths> ? VUnion<Type | undefined, Members, "optional", FieldPaths> : never;
/**
 * Type representing whether a property in an object is optional or required.
 *
 * @public
 */
export type OptionalProperty = "optional" | "required";
/**
 * A validator for a Convex value.
 *
 * This should be constructed using the validator builder, {@link v}.
 *
 * A validator encapsulates:
 * - The TypeScript type of this value.
 * - Whether this field should be optional if it's included in an object.
 * - The TypeScript type for the set of index field paths that can be used to
 * build indexes on this value.
 * - A JSON representation of the validator.
 *
 * Specific types of validators contain additional information: for example
 * an `ArrayValidator` contains an `element` property with the validator
 * used to validate each element of the list. Use the shared 'kind' property
 * to identity the type of validator.
 *
 * More validators can be added in future releases so an exhaustive
 * switch statement on validator `kind` should be expected to break
 * in future releases of Convex.
 *
 * @public
 */
export type Validator<Type, IsOptional extends OptionalProperty = "required", FieldPaths extends string = never> = VId<Type, IsOptional> | VString<Type, IsOptional> | VFloat64<Type, IsOptional> | VInt64<Type, IsOptional> | VBoolean<Type, IsOptional> | VNull<Type, IsOptional> | VAny<Type, IsOptional> | VLiteral<Type, IsOptional> | VBytes<Type, IsOptional> | VObject<Type, Record<string, Validator<any, OptionalProperty, any>>, IsOptional, FieldPaths> | VArray<Type, Validator<any, "required", any>, IsOptional> | VRecord<Type, Validator<string, "required", any>, Validator<any, "required", any>, IsOptional, FieldPaths> | VUnion<Type, Validator<any, "required", any>[], IsOptional, FieldPaths>;
/**
 * Join together two index field paths.
 *
 * This is used within the validator builder, {@link v}.
 * @public
 */
export type JoinFieldPaths<Start extends string, End extends string> = `${Start}.${End}`;
export type ObjectFieldType = {
    fieldType: ValidatorJSON;
    optional: boolean;
};
export type ValidatorJSON = {
    type: "null";
} | {
    type: "number";
} | {
    type: "bigint";
} | {
    type: "boolean";
} | {
    type: "string";
} | {
    type: "bytes";
} | {
    type: "any";
} | {
    type: "literal";
    value: JSONValue;
} | {
    type: "id";
    tableName: string;
} | {
    type: "array";
    value: ValidatorJSON;
} | {
    type: "record";
    keys: RecordKeyValidatorJSON;
    values: RecordValueValidatorJSON;
} | {
    type: "object";
    value: Record<string, ObjectFieldType>;
} | {
    type: "union";
    value: ValidatorJSON[];
};
export type RecordKeyValidatorJSON = {
    type: "string";
} | {
    type: "id";
    tableName: string;
} | {
    type: "union";
    value: RecordKeyValidatorJSON[];
};
export type RecordValueValidatorJSON = ObjectFieldType & {
    optional: false;
};
export {};
//# sourceMappingURL=validators.d.ts.map