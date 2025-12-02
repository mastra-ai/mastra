"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
exports.__esModule = true;
exports.parseRule = exports.parse = void 0;
var grammar = __importStar(require("./grammar.js"));
var AST = __importStar(require("./ast"));
var expander_1 = require("./expander");
function parse(input) {
    var ast = parseRule(input, "template");
    return {
        ast: ast,
        expand: function (values) { return (0, expander_1.expandTemplate)(ast, values); },
        toString: function () { return AST.toString(ast); }
    };
}
exports.parse = parse;
function parseRule(input, startRule) {
    if (startRule === void 0) { startRule = "template"; }
    return grammar.parse(input, { startRule: startRule });
}
exports.parseRule = parseRule;
__exportStar(require("./expander"), exports);
