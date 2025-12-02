import { NumberValue } from "./NumberValue";
export const convertToNative = (data, options) => {
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
