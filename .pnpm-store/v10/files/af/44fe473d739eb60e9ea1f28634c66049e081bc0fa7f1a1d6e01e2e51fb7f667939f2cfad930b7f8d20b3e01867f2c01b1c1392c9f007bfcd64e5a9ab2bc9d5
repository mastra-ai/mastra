"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAsyncToFunctionFix = void 0;
const addAsyncToFunctionFix = (fixer, ruleFix, functionExpression) => {
    if (functionExpression && !functionExpression.async) {
        functionExpression.async = true;
        return [ruleFix, fixer.insertTextBefore(functionExpression, 'async ')];
    }
    return ruleFix;
};
exports.addAsyncToFunctionFix = addAsyncToFunctionFix;
