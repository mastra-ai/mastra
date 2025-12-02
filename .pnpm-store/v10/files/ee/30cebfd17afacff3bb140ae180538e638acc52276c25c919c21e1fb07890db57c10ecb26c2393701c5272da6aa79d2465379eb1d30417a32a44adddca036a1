'use strict';

class NumberValue {
    value;
    constructor(value) {
        if (typeof value === "object" && "N" in value) {
            this.value = String(value.N);
        }
        else {
            this.value = String(value);
        }
        const valueOf = typeof value.valueOf() === "number" ? value.valueOf() : 0;
        const imprecise = valueOf > Number.MAX_SAFE_INTEGER ||
            valueOf < Number.MIN_SAFE_INTEGER ||
            Math.abs(valueOf) === Infinity ||
            Number.isNaN(valueOf);
        if (imprecise) {
            throw new Error(`NumberValue should not be initialized with an imprecise number=${valueOf}. Use a string instead.`);
        }
    }
    static from(value) {
        return new NumberValue(value);
    }
    toAttributeValue() {
        return {
            N: this.toString(),
        };
    }
    toBigInt() {
        const stringValue = this.toString();
        return BigInt(stringValue);
    }
    toString() {
        return String(this.value);
    }
    valueOf() {
        return this.toString();
    }
}

const convertToAttr = (data, options) => {
    if (data === undefined) {
        throw new Error(`Pass options.removeUndefinedValues=true to remove undefined values from map/array/set.`);
    }
    else if (data === null && typeof data === "object") {
        return convertToNullAttr();
    }
    else if (Array.isArray(data)) {
        return convertToListAttr(data, options);
    }
    else if (data?.constructor?.name === "Set") {
        return convertToSetAttr(data, options);
    }
    else if (data?.constructor?.name === "Map") {
        return convertToMapAttrFromIterable(data, options);
    }
    else if (data?.constructor?.name === "Object" ||
        (!data.constructor && typeof data === "object")) {
        return convertToMapAttrFromEnumerableProps(data, options);
    }
    else if (isBinary(data)) {
        if (data.length === 0 && options?.convertEmptyValues) {
            return convertToNullAttr();
        }
        return convertToBinaryAttr(data);
    }
    else if (typeof data === "boolean" || data?.constructor?.name === "Boolean") {
        return { BOOL: data.valueOf() };
    }
    else if (typeof data === "number" || data?.constructor?.name === "Number") {
        return convertToNumberAttr(data, options);
    }
    else if (data instanceof NumberValue) {
        return data.toAttributeValue();
    }
    else if (typeof data === "bigint") {
        return convertToBigIntAttr(data);
    }
    else if (typeof data === "string" || data?.constructor?.name === "String") {
        if (data.length === 0 && options?.convertEmptyValues) {
            return convertToNullAttr();
        }
        return convertToStringAttr(data);
    }
    else if (options?.convertClassInstanceToMap && typeof data === "object") {
        return convertToMapAttrFromEnumerableProps(data, options);
    }
    throw new Error(`Unsupported type passed: ${data}. Pass options.convertClassInstanceToMap=true to marshall typeof object as map attribute.`);
};
const convertToListAttr = (data, options) => ({
    L: data
        .filter((item) => typeof item !== "function" &&
        (!options?.removeUndefinedValues || (options?.removeUndefinedValues && item !== undefined)))
        .map((item) => convertToAttr(item, options)),
});
const convertToSetAttr = (set, options) => {
    const setToOperate = options?.removeUndefinedValues ? new Set([...set].filter((value) => value !== undefined)) : set;
    if (!options?.removeUndefinedValues && setToOperate.has(undefined)) {
        throw new Error(`Pass options.removeUndefinedValues=true to remove undefined values from map/array/set.`);
    }
    if (setToOperate.size === 0) {
        if (options?.convertEmptyValues) {
            return convertToNullAttr();
        }
        throw new Error(`Pass a non-empty set, or options.convertEmptyValues=true.`);
    }
    const item = setToOperate.values().next().value;
    if (item instanceof NumberValue) {
        return {
            NS: Array.from(setToOperate).map((_) => _.toString()),
        };
    }
    else if (typeof item === "number") {
        return {
            NS: Array.from(setToOperate)
                .map((num) => convertToNumberAttr(num, options))
                .map((item) => item.N),
        };
    }
    else if (typeof item === "bigint") {
        return {
            NS: Array.from(setToOperate)
                .map(convertToBigIntAttr)
                .map((item) => item.N),
        };
    }
    else if (typeof item === "string") {
        return {
            SS: Array.from(setToOperate)
                .map(convertToStringAttr)
                .map((item) => item.S),
        };
    }
    else if (isBinary(item)) {
        return {
            BS: Array.from(setToOperate)
                .map(convertToBinaryAttr)
                .map((item) => item.B),
        };
    }
    else {
        throw new Error(`Only Number Set (NS), Binary Set (BS) or String Set (SS) are allowed.`);
    }
};
const convertToMapAttrFromIterable = (data, options) => ({
    M: ((data) => {
        const map = {};
        for (const [key, value] of data) {
            if (typeof value !== "function" && (value !== undefined || !options?.removeUndefinedValues)) {
                map[key] = convertToAttr(value, options);
            }
        }
        return map;
    })(data),
});
const convertToMapAttrFromEnumerableProps = (data, options) => ({
    M: ((data) => {
        const map = {};
        for (const key in data) {
            const value = data[key];
            if (typeof value !== "function" && (value !== undefined || !options?.removeUndefinedValues)) {
                map[key] = convertToAttr(value, options);
            }
        }
        return map;
    })(data),
});
const convertToNullAttr = () => ({ NULL: true });
const convertToBinaryAttr = (data) => ({ B: data });
const convertToStringAttr = (data) => ({ S: data.toString() });
const convertToBigIntAttr = (data) => ({ N: data.toString() });
const validateBigIntAndThrow = (errorPrefix) => {
    throw new Error(`${errorPrefix} Use NumberValue from @aws-sdk/lib-dynamodb.`);
};
const convertToNumberAttr = (num, options) => {
    if ([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
        .map((val) => val.toString())
        .includes(num.toString())) {
        throw new Error(`Special numeric value ${num.toString()} is not allowed`);
    }
    else if (!options?.allowImpreciseNumbers) {
        if (Number(num) > Number.MAX_SAFE_INTEGER) {
            validateBigIntAndThrow(`Number ${num.toString()} is greater than Number.MAX_SAFE_INTEGER.`);
        }
        else if (Number(num) < Number.MIN_SAFE_INTEGER) {
            validateBigIntAndThrow(`Number ${num.toString()} is lesser than Number.MIN_SAFE_INTEGER.`);
        }
    }
    return { N: num.toString() };
};
const isBinary = (data) => {
    const binaryTypes = [
        "ArrayBuffer",
        "Blob",
        "Buffer",
        "DataView",
        "File",
        "Int8Array",
        "Uint8Array",
        "Uint8ClampedArray",
        "Int16Array",
        "Uint16Array",
        "Int32Array",
        "Uint32Array",
        "Float32Array",
        "Float64Array",
        "BigInt64Array",
        "BigUint64Array",
    ];
    if (data?.constructor) {
        return binaryTypes.includes(data.constructor.name);
    }
    return false;
};

const convertToNative = (data, options) => {
    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
            switch (key) {
                case "NULL":
                    return null;
                case "BOOL":
                    return Boolean(value);
                case "N":
                    return convertNumber(value, options);
                case "B":
                    return convertBinary(value);
                case "S":
                    return convertString(value);
                case "L":
                    return convertList(value, options);
                case "M":
                    return convertMap(value, options);
                case "NS":
                    return new Set(value.map((item) => convertNumber(item, options)));
                case "BS":
                    return new Set(value.map(convertBinary));
                case "SS":
                    return new Set(value.map(convertString));
                default:
                    throw new Error(`Unsupported type passed: ${key}`);
            }
        }
    }
    throw new Error(`No value defined: ${JSON.stringify(data)}`);
};
const convertNumber = (numString, options) => {
    if (typeof options?.wrapNumbers === "function") {
        return options?.wrapNumbers(numString);
    }
    if (options?.wrapNumbers) {
        return NumberValue.from(numString);
    }
    const num = Number(numString);
    const infinityValues = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    const isLargeFiniteNumber = (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) && !infinityValues.includes(num);
    if (isLargeFiniteNumber) {
        if (typeof BigInt === "function") {
            try {
                return BigInt(numString);
            }
            catch (error) {
                throw new Error(`${numString} can't be converted to BigInt. Set options.wrapNumbers to get string value.`);
            }
        }
        else {
            throw new Error(`${numString} is outside SAFE_INTEGER bounds. Set options.wrapNumbers to get string value.`);
        }
    }
    return num;
};
const convertString = (stringValue) => stringValue;
const convertBinary = (binaryValue) => binaryValue;
const convertList = (list, options) => list.map((item) => convertToNative(item, options));
const convertMap = (map, options) => Object.entries(map).reduce((acc, [key, value]) => ((acc[key] = convertToNative(value, options)), acc), {});

function marshall(data, options) {
    const attributeValue = convertToAttr(data, options);
    const [key, value] = Object.entries(attributeValue)[0];
    switch (key) {
        case "M":
        case "L":
            return options?.convertTopLevelContainer ? attributeValue : value;
        case "SS":
        case "NS":
        case "BS":
        case "S":
        case "N":
        case "B":
        case "NULL":
        case "BOOL":
        case "$unknown":
        default:
            return attributeValue;
    }
}

const unmarshall = (data, options) => {
    if (options?.convertWithoutMapWrapper) {
        return convertToNative(data, options);
    }
    return convertToNative({ M: data }, options);
};

exports.NumberValueImpl = NumberValue;
exports.convertToAttr = convertToAttr;
exports.convertToNative = convertToNative;
exports.marshall = marshall;
exports.unmarshall = unmarshall;
