import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
export const SELF = null;
export const ALL_VALUES = {};
export const ALL_MEMBERS = [];
const NEXT_LEVEL = "*";
const processObj = (obj, processFunc, keyNodes) => {
    if (obj !== undefined) {
        if (keyNodes == null) {
            return processFunc(obj);
        }
        else {
            const keys = Object.keys(keyNodes);
            const goToNextLevel = keys.length === 1 && keys[0] === NEXT_LEVEL;
            const someChildren = keys.length >= 1 && !goToNextLevel;
            const allChildren = keys.length === 0;
            if (someChildren) {
                return processKeysInObj(obj, processFunc, keyNodes);
            }
            else if (allChildren) {
                return processAllKeysInObj(obj, processFunc, SELF);
            }
            else if (goToNextLevel) {
                return Object.entries(obj ?? {}).reduce((acc, [k, v]) => {
                    if (typeof v !== "function") {
                        acc[k] = processObj(v, processFunc, keyNodes[NEXT_LEVEL]);
                    }
                    return acc;
                }, (Array.isArray(obj) ? [] : {}));
            }
        }
    }
    return undefined;
};
const processKeysInObj = (obj, processFunc, keyNodes) => {
    let accumulator;
    if (Array.isArray(obj)) {
        accumulator = obj.filter((item) => typeof item !== "function");
    }
    else {
        accumulator = {};
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v !== "function") {
                accumulator[k] = v;
            }
        }
    }
    for (const [nodeKey, nodes] of Object.entries(keyNodes)) {
        if (typeof obj[nodeKey] === "function") {
            continue;
        }
        const processedValue = processObj(obj[nodeKey], processFunc, nodes);
        if (processedValue !== undefined && typeof processedValue !== "function") {
            accumulator[nodeKey] = processedValue;
        }
    }
    return accumulator;
};
const processAllKeysInObj = (obj, processFunc, keyNodes) => {
    if (Array.isArray(obj)) {
        return obj.filter((item) => typeof item !== "function").map((item) => processObj(item, processFunc, keyNodes));
    }
    return Object.entries(obj).reduce((acc, [key, value]) => {
        if (typeof value === "function") {
            return acc;
        }
        const processedValue = processObj(value, processFunc, keyNodes);
        if (processedValue !== undefined && typeof processedValue !== "function") {
            acc[key] = processedValue;
        }
        return acc;
    }, {});
};
export const marshallInput = (obj, keyNodes, options) => {
    const marshallFunc = (toMarshall) => marshall(toMarshall, options);
    return processKeysInObj(obj, marshallFunc, keyNodes);
};
export const unmarshallOutput = (obj, keyNodes, options) => {
    const unmarshallFunc = (toMarshall) => unmarshall(toMarshall, options);
    return processKeysInObj(obj, unmarshallFunc, keyNodes);
};
