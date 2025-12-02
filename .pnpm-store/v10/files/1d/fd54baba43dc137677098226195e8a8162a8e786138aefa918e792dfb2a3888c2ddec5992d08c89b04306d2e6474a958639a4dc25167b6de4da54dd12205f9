"use strict";
var __webpack_require__ = {};
(()=>{
    __webpack_require__.d = (exports1, definition)=>{
        for(var key in definition)if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports1, key)) Object.defineProperty(exports1, key, {
            enumerable: true,
            get: definition[key]
        });
    };
})();
(()=>{
    __webpack_require__.o = (obj, prop)=>Object.prototype.hasOwnProperty.call(obj, prop);
})();
(()=>{
    __webpack_require__.r = (exports1)=>{
        if ('undefined' != typeof Symbol && Symbol.toStringTag) Object.defineProperty(exports1, Symbol.toStringTag, {
            value: 'Module'
        });
        Object.defineProperty(exports1, '__esModule', {
            value: true
        });
    };
})();
var __webpack_exports__ = {};
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
    createModulerModifier: ()=>createModulerModifier
});
const external_path_namespaceObject = require("path");
function createModulerModifier() {
    const getModuleFromFileName = createGetModuleFromFilename();
    return async (frames)=>{
        for (const frame of frames)frame.module = getModuleFromFileName(frame.filename);
        return frames;
    };
}
function createGetModuleFromFilename(basePath = process.argv[1] ? (0, external_path_namespaceObject.dirname)(process.argv[1]) : process.cwd(), isWindows = '\\' === external_path_namespaceObject.sep) {
    const normalizedBase = isWindows ? normalizeWindowsPath(basePath) : basePath;
    return (filename)=>{
        if (!filename) return;
        const normalizedFilename = isWindows ? normalizeWindowsPath(filename) : filename;
        let { dir, base: file, ext } = external_path_namespaceObject.posix.parse(normalizedFilename);
        if ('.js' === ext || '.mjs' === ext || '.cjs' === ext) file = file.slice(0, -1 * ext.length);
        const decodedFile = decodeURIComponent(file);
        if (!dir) dir = '.';
        const n = dir.lastIndexOf('/node_modules');
        if (n > -1) return `${dir.slice(n + 14).replace(/\//g, '.')}:${decodedFile}`;
        if (dir.startsWith(normalizedBase)) {
            const moduleName = dir.slice(normalizedBase.length + 1).replace(/\//g, '.');
            return moduleName ? `${moduleName}:${decodedFile}` : decodedFile;
        }
        return decodedFile;
    };
}
function normalizeWindowsPath(path) {
    return path.replace(/^[A-Z]:/, '').replace(/\\/g, '/');
}
exports.createModulerModifier = __webpack_exports__.createModulerModifier;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "createModulerModifier"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
