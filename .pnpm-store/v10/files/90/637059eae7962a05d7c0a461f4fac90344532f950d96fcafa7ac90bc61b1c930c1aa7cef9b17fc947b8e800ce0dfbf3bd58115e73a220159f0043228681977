"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isImportDeclaration = isImportDeclaration;
exports.isProgram = isProgram;
exports.isImportSpecifierArray = isImportSpecifierArray;
function isImportDeclaration(node) {
    return node.type === "ImportDeclaration";
}
function isProgram(node) {
    return node.type === "Program";
}
function isImportSpecifierArray(items) {
    return items.every((item) => item.type === "ImportSpecifier");
}
//# sourceMappingURL=guards.js.map