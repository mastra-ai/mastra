/**
 * Copyright (c) 2020, Peculiar Ventures, All rights reserved.
 */

'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

class JsonError extends Error {
    constructor(message, innerError) {
        super(innerError
            ? `${message}. See the inner exception for more details.`
            : message);
        this.message = message;
        this.innerError = innerError;
    }
}

class TransformError extends JsonError {
    constructor(schema, message, innerError) {
        super(message, innerError);
        this.schema = schema;
    }
}

class ParserError extends TransformError {
    constructor(schema, message, innerError) {
        super(schema, `JSON doesn't match to '${schema.target.name}' schema. ${message}`, innerError);
    }
}

class ValidationError extends JsonError {
}

class SerializerError extends JsonError {
    constructor(schemaName, message, innerError) {
        super(`Cannot serialize by '${schemaName}' schema. ${message}`, innerError);
        this.schemaName = schemaName;
    }
}

class KeyError extends ParserError {
    constructor(schema, keys, errors = {}) {
        super(schema, "Some keys doesn't match to schema");
        this.keys = keys;
        this.errors = errors;
    }
}

(function (JsonPropTypes) {
    JsonPropTypes[JsonPropTypes["Any"] = 0] = "Any";
    JsonPropTypes[JsonPropTypes["Boolean"] = 1] = "Boolean";
    JsonPropTypes[JsonPropTypes["Number"] = 2] = "Number";
    JsonPropTypes[JsonPropTypes["String"] = 3] = "String";
})(exports.JsonPropTypes || (exports.JsonPropTypes = {}));

function checkType(value, type) {
    switch (type) {
        case exports.JsonPropTypes.Boolean:
            return typeof value === "boolean";
        case exports.JsonPropTypes.Number:
            return typeof value === "number";
        case exports.JsonPropTypes.String:
            return typeof value === "string";
    }
    return true;
}
function throwIfTypeIsWrong(value, type) {
    if (!checkType(value, type)) {
        throw new TypeError(`Value must be ${exports.JsonPropTypes[type]}`);
    }
}
function isConvertible(target) {
    if (target && target.prototype) {
        if (target.prototype.toJSON && target.prototype.fromJSON) {
            return true;
        }
        else {
            return isConvertible(target.prototype);
        }
    }
    else {
        return !!(target && target.toJSON && target.fromJSON);
    }
}

class JsonSchemaStorage {
    constructor() {
        this.items = new Map();
    }
    has(target) {
        return this.items.has(target) || !!this.findParentSchema(target);
    }
    get(target) {
        const schema = this.items.get(target) || this.findParentSchema(target);
        if (!schema) {
            throw new Error("Cannot get schema for current target");
        }
        return schema;
    }
    create(target) {
        const schema = { names: {} };
        const parentSchema = this.findParentSchema(target);
        if (parentSchema) {
            Object.assign(schema, parentSchema);
            schema.names = {};
            for (const name in parentSchema.names) {
                schema.names[name] = Object.assign({}, parentSchema.names[name]);
            }
        }
        schema.target = target;
        return schema;
    }
    set(target, schema) {
        this.items.set(target, schema);
        return this;
    }
    findParentSchema(target) {
        const parent = target.__proto__;
        if (parent) {
            const schema = this.items.get(parent);
            return schema || this.findParentSchema(parent);
        }
        return null;
    }
}

const DEFAULT_SCHEMA = "default";
const schemaStorage = new JsonSchemaStorage();

class PatternValidation {
    constructor(pattern) {
        this.pattern = new RegExp(pattern);
    }
    validate(value) {
        const pattern = new RegExp(this.pattern.source, this.pattern.flags);
        if (typeof value !== "string") {
            throw new ValidationError("Incoming value must be string");
        }
        if (!pattern.exec(value)) {
            throw new ValidationError(`Value doesn't match to pattern '${pattern.toString()}'`);
        }
    }
}

class InclusiveValidation {
    constructor(min = Number.MIN_VALUE, max = Number.MAX_VALUE) {
        this.min = min;
        this.max = max;
    }
    validate(value) {
        throwIfTypeIsWrong(value, exports.JsonPropTypes.Number);
        if (!(this.min <= value && value <= this.max)) {
            const min = this.min === Number.MIN_VALUE ? "MIN" : this.min;
            const max = this.max === Number.MAX_VALUE ? "MAX" : this.max;
            throw new ValidationError(`Value doesn't match to diapason [${min},${max}]`);
        }
    }
}

class ExclusiveValidation {
    constructor(min = Number.MIN_VALUE, max = Number.MAX_VALUE) {
        this.min = min;
        this.max = max;
    }
    validate(value) {
        throwIfTypeIsWrong(value, exports.JsonPropTypes.Number);
        if (!(this.min < value && value < this.max)) {
            const min = this.min === Number.MIN_VALUE ? "MIN" : this.min;
            const max = this.max === Number.MAX_VALUE ? "MAX" : this.max;
            throw new ValidationError(`Value doesn't match to diapason (${min},${max})`);
        }
    }
}

class LengthValidation {
    constructor(length, minLength, maxLength) {
        this.length = length;
        this.minLength = minLength;
        this.maxLength = maxLength;
    }
    validate(value) {
        if (this.length !== undefined) {
            if (value.length !== this.length) {
                throw new ValidationError(`Value length must be exactly ${this.length}.`);
            }
            return;
        }
        if (this.minLength !== undefined) {
            if (value.length < this.minLength) {
                throw new ValidationError(`Value length must be more than ${this.minLength}.`);
            }
        }
        if (this.maxLength !== undefined) {
            if (value.length > this.maxLength) {
                throw new ValidationError(`Value length must be less than ${this.maxLength}.`);
            }
        }
    }
}

class EnumerationValidation {
    constructor(enumeration) {
        this.enumeration = enumeration;
    }
    validate(value) {
        throwIfTypeIsWrong(value, exports.JsonPropTypes.String);
        if (!this.enumeration.includes(value)) {
            throw new ValidationError(`Value must be one of ${this.enumeration.map((v) => `'${v}'`).join(", ")}`);
        }
    }
}

class JsonTransform {
    static checkValues(data, schemaItem) {
        const values = Array.isArray(data) ? data : [data];
        for (const value of values) {
            for (const validation of schemaItem.validations) {
                if (validation instanceof LengthValidation && schemaItem.repeated) {
                    validation.validate(data);
                }
                else {
                    validation.validate(value);
                }
            }
        }
    }
    static checkTypes(value, schemaItem) {
        if (schemaItem.repeated && !Array.isArray(value)) {
            throw new TypeError("Value must be Array");
        }
        if (typeof schemaItem.type === "number") {
            const values = Array.isArray(value) ? value : [value];
            for (const v of values) {
                throwIfTypeIsWrong(v, schemaItem.type);
            }
        }
    }
    static getSchemaByName(schema, name = DEFAULT_SCHEMA) {
        return { ...schema.names[DEFAULT_SCHEMA], ...schema.names[name] };
    }
}

class JsonSerializer extends JsonTransform {
    static serialize(obj, options, replacer, space) {
        const json = this.toJSON(obj, options);
        return JSON.stringify(json, replacer, space);
    }
    static toJSON(obj, options = {}) {
        let res;
        let targetSchema = options.targetSchema;
        const schemaName = options.schemaName || DEFAULT_SCHEMA;
        if (isConvertible(obj)) {
            return obj.toJSON();
        }
        if (Array.isArray(obj)) {
            res = [];
            for (const item of obj) {
                res.push(this.toJSON(item, options));
            }
        }
        else if (typeof obj === "object") {
            if (targetSchema && !schemaStorage.has(targetSchema)) {
                throw new JsonError("Cannot get schema for `targetSchema` param");
            }
            targetSchema = (targetSchema || obj.constructor);
            if (schemaStorage.has(targetSchema)) {
                const schema = schemaStorage.get(targetSchema);
                res = {};
                const namedSchema = this.getSchemaByName(schema, schemaName);
                for (const key in namedSchema) {
                    try {
                        const item = namedSchema[key];
                        const objItem = obj[key];
                        let value;
                        if ((item.optional && objItem === undefined)
                            || (item.defaultValue !== undefined && objItem === item.defaultValue)) {
                            continue;
                        }
                        if (!item.optional && objItem === undefined) {
                            throw new SerializerError(targetSchema.name, `Property '${key}' is required.`);
                        }
                        if (typeof item.type === "number") {
                            if (item.converter) {
                                if (item.repeated) {
                                    value = objItem.map((el) => item.converter.toJSON(el, obj));
                                }
                                else {
                                    value = item.converter.toJSON(objItem, obj);
                                }
                            }
                            else {
                                value = objItem;
                            }
                        }
                        else {
                            if (item.repeated) {
                                value = objItem.map((el) => this.toJSON(el, { schemaName }));
                            }
                            else {
                                value = this.toJSON(objItem, { schemaName });
                            }
                        }
                        this.checkTypes(value, item);
                        this.checkValues(value, item);
                        res[item.name || key] = value;
                    }
                    catch (e) {
                        if (e instanceof SerializerError) {
                            throw e;
                        }
                        else {
                            throw new SerializerError(schema.target.name, `Property '${key}' is wrong. ${e.message}`, e);
                        }
                    }
                }
            }
            else {
                res = {};
                for (const key in obj) {
                    res[key] = this.toJSON(obj[key], { schemaName });
                }
            }
        }
        else {
            res = obj;
        }
        return res;
    }
}

class JsonParser extends JsonTransform {
    static parse(data, options) {
        const obj = JSON.parse(data);
        return this.fromJSON(obj, options);
    }
    static fromJSON(target, options) {
        const targetSchema = options.targetSchema;
        const schemaName = options.schemaName || DEFAULT_SCHEMA;
        const obj = new targetSchema();
        if (isConvertible(obj)) {
            return obj.fromJSON(target);
        }
        const schema = schemaStorage.get(targetSchema);
        const namedSchema = this.getSchemaByName(schema, schemaName);
        const keyErrors = {};
        if (options.strictProperty && !Array.isArray(target)) {
            JsonParser.checkStrictProperty(target, namedSchema, schema);
        }
        for (const key in namedSchema) {
            try {
                const item = namedSchema[key];
                const name = item.name || key;
                const value = target[name];
                if (value === undefined && (item.optional || item.defaultValue !== undefined)) {
                    continue;
                }
                if (!item.optional && value === undefined) {
                    throw new ParserError(schema, `Property '${name}' is required.`);
                }
                this.checkTypes(value, item);
                this.checkValues(value, item);
                if (typeof (item.type) === "number") {
                    if (item.converter) {
                        if (item.repeated) {
                            obj[key] = value.map((el) => item.converter.fromJSON(el, obj));
                        }
                        else {
                            obj[key] = item.converter.fromJSON(value, obj);
                        }
                    }
                    else {
                        obj[key] = value;
                    }
                }
                else {
                    const newOptions = {
                        ...options,
                        targetSchema: item.type,
                        schemaName,
                    };
                    if (item.repeated) {
                        obj[key] = value.map((el) => this.fromJSON(el, newOptions));
                    }
                    else {
                        obj[key] = this.fromJSON(value, newOptions);
                    }
                }
            }
            catch (e) {
                if (!(e instanceof ParserError)) {
                    e = new ParserError(schema, `Property '${key}' is wrong. ${e.message}`, e);
                }
                if (options.strictAllKeys) {
                    keyErrors[key] = e;
                }
                else {
                    throw e;
                }
            }
        }
        const keys = Object.keys(keyErrors);
        if (keys.length) {
            throw new KeyError(schema, keys, keyErrors);
        }
        return obj;
    }
    static checkStrictProperty(target, namedSchema, schema) {
        const jsonProps = Object.keys(target);
        const schemaProps = Object.keys(namedSchema);
        const keys = [];
        for (const key of jsonProps) {
            if (schemaProps.indexOf(key) === -1) {
                keys.push(key);
            }
        }
        if (keys.length) {
            throw new KeyError(schema, keys);
        }
    }
}

function getValidations(item) {
    const validations = [];
    if (item.pattern) {
        validations.push(new PatternValidation(item.pattern));
    }
    if (item.type === exports.JsonPropTypes.Number || item.type === exports.JsonPropTypes.Any) {
        if (item.minInclusive !== undefined || item.maxInclusive !== undefined) {
            validations.push(new InclusiveValidation(item.minInclusive, item.maxInclusive));
        }
        if (item.minExclusive !== undefined || item.maxExclusive !== undefined) {
            validations.push(new ExclusiveValidation(item.minExclusive, item.maxExclusive));
        }
        if (item.enumeration !== undefined) {
            validations.push(new EnumerationValidation(item.enumeration));
        }
    }
    if (item.type === exports.JsonPropTypes.String || item.repeated || item.type === exports.JsonPropTypes.Any) {
        if (item.length !== undefined || item.minLength !== undefined || item.maxLength !== undefined) {
            validations.push(new LengthValidation(item.length, item.minLength, item.maxLength));
        }
    }
    return validations;
}
const JsonProp = (options = {}) => (target, propertyKey) => {
    const errorMessage = `Cannot set type for ${propertyKey} property of ${target.constructor.name} schema`;
    let schema;
    if (!schemaStorage.has(target.constructor)) {
        schema = schemaStorage.create(target.constructor);
        schemaStorage.set(target.constructor, schema);
    }
    else {
        schema = schemaStorage.get(target.constructor);
        if (schema.target !== target.constructor) {
            schema = schemaStorage.create(target.constructor);
            schemaStorage.set(target.constructor, schema);
        }
    }
    const defaultSchema = {
        type: exports.JsonPropTypes.Any,
        validations: [],
    };
    const copyOptions = Object.assign(defaultSchema, options);
    copyOptions.validations = getValidations(copyOptions);
    if (typeof copyOptions.type !== "number") {
        if (!schemaStorage.has(copyOptions.type) && !isConvertible(copyOptions.type)) {
            throw new Error(`${errorMessage}. Assigning type doesn't have schema.`);
        }
    }
    let schemaNames;
    if (Array.isArray(options.schema)) {
        schemaNames = options.schema;
    }
    else {
        schemaNames = [options.schema || DEFAULT_SCHEMA];
    }
    for (const schemaName of schemaNames) {
        if (!schema.names[schemaName]) {
            schema.names[schemaName] = {};
        }
        const namedSchema = schema.names[schemaName];
        namedSchema[propertyKey] = copyOptions;
    }
};

exports.JsonError = JsonError;
exports.JsonParser = JsonParser;
exports.JsonProp = JsonProp;
exports.JsonSerializer = JsonSerializer;
exports.KeyError = KeyError;
exports.ParserError = ParserError;
exports.SerializerError = SerializerError;
exports.TransformError = TransformError;
exports.ValidationError = ValidationError;
