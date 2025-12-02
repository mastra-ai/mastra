"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.util = void 0;
const ifaces_1 = require("../ifaces");
const enums_1 = require("./enums");
var util;
(function (util) {
    function assertNever(arg, error) {
        throw error ?? new Error(`${arg} is supposed to be of "never" type`);
    }
    util.assertNever = assertNever;
    function splitName(name) {
        if (!name.includes("::"))
            throw new Error(`Invalid FQN ${name}`);
        const parts = name.split("::");
        return {
            mod: parts.slice(0, -1).join("::"),
            name: parts[parts.length - 1],
        };
    }
    util.splitName = splitName;
    function toIdent(name) {
        if (name.includes("::")) {
            throw new Error(`toIdent: invalid name ${name}`);
        }
        return name.replace(/([^a-zA-Z0-9_]+)/g, "_");
    }
    util.toIdent = toIdent;
    util.deduplicate = (args) => [...new Set(args)];
    util.getFromArrayMap = (map, id) => {
        return map[id] || [];
    };
    util.defineProperty = (obj, name, def) => {
        return Object.defineProperty(obj, name, def);
    };
    util.defineGetter = (obj, name, getter) => {
        return Object.defineProperty(obj, name, {
            get: getter,
            enumerable: true,
        });
    };
    util.defineMethod = (obj, name, method) => {
        obj[name] = method.bind(obj);
        return obj;
    };
    function flatMap(array, callbackfn) {
        return Array.prototype.concat(...array.map(callbackfn));
    }
    util.flatMap = flatMap;
    function omitDollarPrefixed(object) {
        const obj = {};
        for (const key of Object.keys(object)) {
            if (!key.startsWith("$")) {
                obj[key] = object[key];
            }
        }
        return obj;
    }
    util.omitDollarPrefixed = omitDollarPrefixed;
    util.parseCardinality = (cardinality) => {
        switch (cardinality) {
            case ifaces_1.Cardinality.MANY:
                return enums_1.Cardinality.Many;
            case ifaces_1.Cardinality.ONE:
                return enums_1.Cardinality.One;
            case ifaces_1.Cardinality.AT_MOST_ONE:
                return enums_1.Cardinality.AtMostOne;
            case ifaces_1.Cardinality.AT_LEAST_ONE:
                return enums_1.Cardinality.AtLeastOne;
            case ifaces_1.Cardinality.NO_RESULT:
                return enums_1.Cardinality.Empty;
        }
        throw new Error(`Unexpected cardinality: ${cardinality}`);
    };
})(util || (exports.util = util = {}));
