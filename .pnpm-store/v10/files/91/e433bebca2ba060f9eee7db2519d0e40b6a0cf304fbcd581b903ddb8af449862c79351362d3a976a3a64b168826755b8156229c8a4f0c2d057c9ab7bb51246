import { parseAnyOf } from "./parseAnyOf.js";
import { parseBoolean } from "./parseBoolean.js";
import { parseDefault } from "./parseDefault.js";
import { parseMultipleType } from "./parseMultipleType.js";
import { parseNot } from "./parseNot.js";
import { parseNull } from "./parseNull.js";
import { parseAllOf } from "./parseAllOf.js";
import { parseArray } from "./parseArray.js";
import { parseConst } from "./parseConst.js";
import { parseEnum } from "./parseEnum.js";
import { parseIfThenElse } from "./parseIfThenElse.js";
import { parseNumber } from "./parseNumber.js";
import { parseObject } from "./parseObject.js";
import { parseString } from "./parseString.js";
import { parseOneOf } from "./parseOneOf.js";
import { parseSimpleDiscriminatedOneOf } from "./parseSimpleDiscriminatedOneOf.js";
import { parseNullable } from "./parseNullable.js";
export const parseSchema = (schema, refs = { seen: new Map(), path: [] }, blockMeta) => {
    if (typeof schema !== "object")
        return schema ? "z.any()" : "z.never()";
    if (refs.parserOverride) {
        const custom = refs.parserOverride(schema, refs);
        if (typeof custom === "string") {
            return custom;
        }
    }
    let seen = refs.seen.get(schema);
    if (seen) {
        if (seen.r !== undefined) {
            return seen.r;
        }
        if (refs.depth === undefined || seen.n >= refs.depth) {
            return "z.any()";
        }
        seen.n += 1;
    }
    else {
        seen = { r: undefined, n: 0 };
        refs.seen.set(schema, seen);
    }
    let parsed = selectParser(schema, refs);
    if (!blockMeta) {
        if (!refs.withoutDescribes) {
            parsed = addDescribes(schema, parsed);
        }
        if (!refs.withoutDefaults) {
            parsed = addDefaults(schema, parsed);
        }
        parsed = addAnnotations(schema, parsed);
    }
    seen.r = parsed;
    return parsed;
};
const addDescribes = (schema, parsed) => {
    if (schema.description) {
        parsed += `.describe(${JSON.stringify(schema.description)})`;
    }
    return parsed;
};
const addDefaults = (schema, parsed) => {
    if (schema.default !== undefined) {
        parsed += `.default(${JSON.stringify(schema.default)})`;
    }
    return parsed;
};
const addAnnotations = (schema, parsed) => {
    if (schema.readOnly) {
        parsed += ".readonly()";
    }
    return parsed;
};
const selectParser = (schema, refs) => {
    if (its.a.nullable(schema)) {
        return parseNullable(schema, refs);
    }
    else if (its.an.object(schema)) {
        return parseObject(schema, refs);
    }
    else if (its.an.array(schema)) {
        return parseArray(schema, refs);
    }
    else if (its.an.anyOf(schema)) {
        return parseAnyOf(schema, refs);
    }
    else if (its.an.allOf(schema)) {
        return parseAllOf(schema, refs);
    }
    else if (its.a.simpleDiscriminatedOneOf(schema)) {
        return parseSimpleDiscriminatedOneOf(schema, refs);
    }
    else if (its.a.oneOf(schema)) {
        return parseOneOf(schema, refs);
    }
    else if (its.a.not(schema)) {
        return parseNot(schema, refs);
    }
    else if (its.an.enum(schema)) {
        return parseEnum(schema); //<-- needs to come before primitives
    }
    else if (its.a.const(schema)) {
        return parseConst(schema);
    }
    else if (its.a.multipleType(schema)) {
        return parseMultipleType(schema, refs);
    }
    else if (its.a.primitive(schema, "string")) {
        return parseString(schema);
    }
    else if (its.a.primitive(schema, "number") ||
        its.a.primitive(schema, "integer")) {
        return parseNumber(schema);
    }
    else if (its.a.primitive(schema, "boolean")) {
        return parseBoolean(schema);
    }
    else if (its.a.primitive(schema, "null")) {
        return parseNull(schema);
    }
    else if (its.a.conditional(schema)) {
        return parseIfThenElse(schema, refs);
    }
    else {
        return parseDefault(schema);
    }
};
export const its = {
    an: {
        object: (x) => x.type === "object",
        array: (x) => x.type === "array",
        anyOf: (x) => x.anyOf !== undefined,
        allOf: (x) => x.allOf !== undefined,
        enum: (x) => x.enum !== undefined,
    },
    a: {
        nullable: (x) => x.nullable === true,
        multipleType: (x) => Array.isArray(x.type),
        not: (x) => x.not !== undefined,
        const: (x) => x.const !== undefined,
        primitive: (x, p) => x.type === p,
        conditional: (x) => Boolean("if" in x && x.if && "then" in x && "else" in x && x.then && x.else),
        simpleDiscriminatedOneOf: (x) => {
            if (!x.oneOf ||
                !Array.isArray(x.oneOf) ||
                x.oneOf.length === 0 ||
                !x.discriminator ||
                typeof x.discriminator !== "object" ||
                !("propertyName" in x.discriminator) ||
                typeof x.discriminator.propertyName !== "string") {
                return false;
            }
            const discriminatorProp = x.discriminator.propertyName;
            return x.oneOf.every((schema) => {
                if (!schema ||
                    typeof schema !== "object" ||
                    schema.type !== "object" ||
                    !schema.properties ||
                    typeof schema.properties !== "object" ||
                    !(discriminatorProp in schema.properties)) {
                    return false;
                }
                const property = schema.properties[discriminatorProp];
                return (property &&
                    typeof property === "object" &&
                    property.type === "string" &&
                    // Ensure discriminator has a constant value (const or single-value enum)
                    (property.const !== undefined ||
                        (property.enum && Array.isArray(property.enum) && property.enum.length === 1)) &&
                    // Ensure discriminator property is required
                    Array.isArray(schema.required) &&
                    schema.required.includes(discriminatorProp));
            });
        },
        oneOf: (x) => x.oneOf !== undefined,
    },
};
