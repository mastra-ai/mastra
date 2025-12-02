"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
exports.expandExpression = exports.expandTemplate = void 0;
var pct_encode_1 = __importDefault(require("pct-encode"));
var encoders = {
    UrlSafe: (0, pct_encode_1["default"])(/[^\w~.-]/g),
    Restricted: (0, pct_encode_1["default"])(/[^\w.~:\/\?#\[\]@!\$&'()*+,;=%-]|%(?!\d\d)/g)
};
function expandTemplate(ast, values) {
    var strings = ast.parts.map(function (part) {
        switch (part.type) {
            case "literal":
                return part.value;
            case "expression":
                return expandExpression(part, values);
        }
    });
    return strings.join("");
}
exports.expandTemplate = expandTemplate;
var defaults = {
    first: "",
    sep: ",",
    empty: "",
    encode: encoders.UrlSafe,
    named: false
};
var OperatorConfigs = {
    "": __assign({}, defaults),
    "+": __assign(__assign({}, defaults), { encode: encoders.Restricted }),
    "#": __assign(__assign({}, defaults), { encode: encoders.Restricted, first: "#", empty: "#" }),
    "/": __assign(__assign({}, defaults), { first: "/", sep: "/" }),
    ".": __assign(__assign({}, defaults), { first: ".", sep: ".", empty: "." }),
    ";": __assign(__assign({}, defaults), { first: ";", sep: ";", named: true }),
    "?": __assign(__assign({}, defaults), { first: "?", sep: "&", empty: "=", named: true }),
    "&": __assign(__assign({}, defaults), { first: "&", sep: "&", empty: "=", named: true })
};
function expandExpression(expression, values) {
    var config = OperatorConfigs[expression.operator];
    var strings = [];
    expression.variables.forEach(function (variable) {
        var value = values[variable.name];
        if (!present(value))
            return;
        var string = expandVariable(variable, value, config);
        strings.push(string || "");
    });
    if (strings.length === 0) {
        return "";
    }
    var expanded = strings.join(config.sep);
    if (expanded.length === 0) {
        return config.empty;
    }
    return config.first + expanded;
}
exports.expandExpression = expandExpression;
function expandVariable(variable, value, config) {
    var _a;
    if (value == null) {
        throw new TypeError("tried to expand null value for variable " + variable.name + ", this is a bug in uri-template");
    }
    if (((_a = variable.modifier) === null || _a === void 0 ? void 0 : _a.type) === "explode") {
        return expandValueExplode(variable, value, config);
    }
    else {
        return expandValueSingle(variable, value, config);
    }
}
function expandValueSingle(variable, value, _a) {
    var _b, _c;
    var empty = _a.empty, encode = _a.encode, named = _a.named;
    if (typeof value === "object" && ((_b = variable.modifier) === null || _b === void 0 ? void 0 : _b.type) === "substr") {
        throw new Error("Prefixed variables do not support lists/maps. Check " + variable.name);
    }
    var out;
    if (Array.isArray(value)) {
        out = value.map(encode).join(",");
    }
    else if (typeof value === "object") {
        out = Object.entries(value)
            .map(function (entry) { return entry.map(encode).join(","); })
            .join(",");
    }
    else {
        out = value.toString();
        if (((_c = variable.modifier) === null || _c === void 0 ? void 0 : _c.type) === "substr") {
            out = out.substring(0, variable.modifier.length);
        }
        out = encode(out);
    }
    if (named) {
        if (out) {
            out = variable.name + "=" + out;
        }
        else {
            out = "" + variable.name + empty;
        }
    }
    return out;
}
function expandValueExplode(variable, value, _a) {
    var encode = _a.encode, named = _a.named, sep = _a.sep;
    if (Array.isArray(value)) {
        var items = value.map(encode);
        if (named) {
            items = items.map(function (item) { return variable.name + "=" + item; });
        }
        return items.join(sep);
    }
    else if (typeof value === "object") {
        var pairs_1 = [];
        Object.entries(value).forEach(function (_a) {
            var k = _a[0], v = _a[1];
            k = encode(k);
            if (Array.isArray(v)) {
                v.forEach(function (item) {
                    pairs_1.push(k + "=" + encode(item));
                });
            }
            else {
                pairs_1.push(k + "=" + encode(v));
            }
        });
        return pairs_1.join(sep);
    }
    else {
        var s = value.toString();
        return encode(s);
    }
}
function present(v) {
    switch (typeof v) {
        case "undefined":
            return false;
        case "object":
            if (v == null) {
                return false;
            }
            if (Array.isArray(v)) {
                return v.length > 0;
            }
            for (var k in v) {
                if (v[k] != null)
                    return true;
            }
            return false;
        default:
            return true;
    }
}
