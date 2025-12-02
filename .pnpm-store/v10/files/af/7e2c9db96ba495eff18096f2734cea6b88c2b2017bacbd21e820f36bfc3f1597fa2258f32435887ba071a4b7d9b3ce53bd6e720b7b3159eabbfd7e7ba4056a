"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeclaredVariables = exports.getScope = exports.getSourceCode = exports.getFilename = void 0;
const getFilename = (context) => {
    var _a;
    return (_a = context.filename) !== null && _a !== void 0 ? _a : context.getFilename();
};
exports.getFilename = getFilename;
const getSourceCode = (context) => {
    var _a;
    return (_a = context.sourceCode) !== null && _a !== void 0 ? _a : context.getSourceCode();
};
exports.getSourceCode = getSourceCode;
const getScope = (context, node) => {
    var _a, _b, _c;
    return (_c = (_b = (_a = (0, exports.getSourceCode)(context)).getScope) === null || _b === void 0 ? void 0 : _b.call(_a, node)) !== null && _c !== void 0 ? _c : context.getScope();
};
exports.getScope = getScope;
const getDeclaredVariables = (context, node) => {
    var _a, _b, _c;
    return ((_c = (_b = (_a = (0, exports.getSourceCode)(context)).getDeclaredVariables) === null || _b === void 0 ? void 0 : _b.call(_a, node)) !== null && _c !== void 0 ? _c : context.getDeclaredVariables(node));
};
exports.getDeclaredVariables = getDeclaredVariables;
