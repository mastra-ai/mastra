"use strict";
exports.__esModule = true;
exports.toString = void 0;
function toString(node) {
    var _a, _b;
    switch (node.type) {
        case "template":
            return node.parts.map(toString).join("");
        case "literal":
            return node.value;
        case "expression":
            return "{" + node.operator + node.variables.map(toString).join(",") + "}";
        case "variable":
            var out = node.name;
            if (((_a = node.modifier) === null || _a === void 0 ? void 0 : _a.type) == "explode") {
                out += "*";
            }
            else if (((_b = node.modifier) === null || _b === void 0 ? void 0 : _b.type) == "substr") {
                out += ":" + node.modifier.length;
            }
            if (node.extension) {
                out += "(" + node.extension + ")";
            }
            return out;
    }
}
exports.toString = toString;
