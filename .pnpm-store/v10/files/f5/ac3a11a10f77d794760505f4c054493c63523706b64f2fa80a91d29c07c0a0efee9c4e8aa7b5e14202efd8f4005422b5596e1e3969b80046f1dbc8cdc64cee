"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.its = exports.parseSchema = void 0;
const parseAnyOf_js_1 = require("./parseAnyOf.js");
const parseBoolean_js_1 = require("./parseBoolean.js");
const parseDefault_js_1 = require("./parseDefault.js");
const parseMultipleType_js_1 = require("./parseMultipleType.js");
const parseNot_js_1 = require("./parseNot.js");
const parseNull_js_1 = require("./parseNull.js");
const parseAllOf_js_1 = require("./parseAllOf.js");
const parseArray_js_1 = require("./parseArray.js");
const parseConst_js_1 = require("./parseConst.js");
const parseEnum_js_1 = require("./parseEnum.js");
const parseIfThenElse_js_1 = require("./parseIfThenElse.js");
const parseNumber_js_1 = require("./parseNumber.js");
const parseObject_js_1 = require("./parseObject.js");
const parseString_js_1 = require("./parseString.js");
const parseOneOf_js_1 = require("./parseOneOf.js");
const parseSimpleDiscriminatedOneOf_js_1 = require("./parseSimpleDiscriminatedOneOf.js");
const parseNullable_js_1 = require("./parseNullable.js");
const parseSchema = (schema, refs = { seen: new Map(), path: [] }, blockMeta) => {
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
exports.parseSchema = parseSchema;
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
    if (exports.its.a.nullable(schema)) {
        return (0, parseNullable_js_1.parseNullable)(schema, refs);
    }
    else if (exports.its.an.object(schema)) {
        return (0, parseObject_js_1.parseObject)(schema, refs);
    }
    else if (exports.its.an.array(schema)) {
        return (0, parseArray_js_1.parseArray)(schema, refs);
    }
    else if (exports.its.an.anyOf(schema)) {
        return (0, parseAnyOf_js_1.parseAnyOf)(schema, refs);
    }
    else if (exports.its.an.allOf(schema)) {
        return (0, parseAllOf_js_1.parseAllOf)(schema, refs);
    }
    else if (exports.its.a.simpleDiscriminatedOneOf(schema)) {
        return (0, parseSimpleDiscriminatedOneOf_js_1.parseSimpleDiscriminatedOneOf)(schema, refs);
    }
    else if (exports.its.a.oneOf(schema)) {
        return (0, parseOneOf_js_1.parseOneOf)(schema, refs);
    }
    else if (exports.its.a.not(schema)) {
        return (0, parseNot_js_1.parseNot)(schema, refs);
    }
    else if (exports.its.an.enum(schema)) {
        return (0, parseEnum_js_1.parseEnum)(schema); //<-- needs to come before primitives
    }
    else if (exports.its.a.const(schema)) {
        return (0, parseConst_js_1.parseConst)(schema);
    }
    else if (exports.its.a.multipleType(schema)) {
        return (0, parseMultipleType_js_1.parseMultipleType)(schema, refs);
    }
    else if (exports.its.a.primitive(schema, "string")) {
        return (0, parseString_js_1.parseString)(schema);
    }
    else if (exports.its.a.primitive(schema, "number") ||
        exports.its.a.primitive(schema, "integer")) {
        return (0, parseNumber_js_1.parseNumber)(schema);
    }
    else if (exports.its.a.primitive(schema, "boolean")) {
        return (0, parseBoolean_js_1.parseBoolean)(schema);
    }
    else if (exports.its.a.primitive(schema, "null")) {
        return (0, parseNull_js_1.parseNull)(schema);
    }
    else if (exports.its.a.conditional(schema)) {
        return (0, parseIfThenElse_js_1.parseIfThenElse)(schema, refs);
    }
    else {
        return (0, parseDefault_js_1.parseDefault)(schema);
    }
};
exports.its = {
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
