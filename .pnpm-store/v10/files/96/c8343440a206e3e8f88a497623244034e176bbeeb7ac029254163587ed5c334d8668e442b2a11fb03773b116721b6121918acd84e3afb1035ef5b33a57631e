"use strict";
var __webpack_require__ = {};
(()=>{
    __webpack_require__.n = (module)=>{
        var getter = module && module.__esModule ? ()=>module['default'] : ()=>module;
        __webpack_require__.d(getter, {
            a: getter
        });
        return getter;
    };
})();
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
    buildLocalBinaryPaths: ()=>buildLocalBinaryPaths,
    resolveBinaryPath: ()=>resolveBinaryPath
});
const external_node_path_namespaceObject = require("node:path");
var external_node_path_default = /*#__PURE__*/ __webpack_require__.n(external_node_path_namespaceObject);
const external_node_fs_namespaceObject = require("node:fs");
var external_node_fs_default = /*#__PURE__*/ __webpack_require__.n(external_node_fs_namespaceObject);
const getLocalPaths = (startPath)=>{
    const paths = [];
    let currentPath = startPath;
    while(true){
        paths.push(currentPath);
        const parentPath = external_node_path_default().resolve(currentPath, '..');
        if (parentPath === currentPath) break;
        currentPath = parentPath;
    }
    return paths;
};
const buildLocalBinaryPaths = (cwd)=>{
    const localPaths = getLocalPaths(external_node_path_default().resolve(cwd)).map((localPath)=>external_node_path_default().join(localPath, 'node_modules/.bin'));
    return localPaths;
};
function resolveBinaryPath(binName, options) {
    const envLocations = options.path.split(external_node_path_default().delimiter);
    const localLocations = buildLocalBinaryPaths(options.cwd);
    const directories = [
        ...new Set([
            ...localLocations,
            ...envLocations
        ])
    ];
    for (const directory of directories){
        const binaryPath = external_node_path_default().join(directory, binName);
        if (external_node_fs_default().existsSync(binaryPath)) return binaryPath;
    }
    throw new Error(`Binary ${binName} not found`);
}
exports.buildLocalBinaryPaths = __webpack_exports__.buildLocalBinaryPaths;
exports.resolveBinaryPath = __webpack_exports__.resolveBinaryPath;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "buildLocalBinaryPaths",
    "resolveBinaryPath"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
