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
    nodeStackLineParser: ()=>nodeStackLineParser
});
const external_base_js_namespaceObject = require("./base.js");
const FILENAME_MATCH = /^\s*[-]{4,}$/;
const FULL_MATCH = /at (?:async )?(?:(.+?)\s+\()?(?:(.+):(\d+):(\d+)?|([^)]+))\)?/;
const nodeStackLineParser = (line)=>{
    const lineMatch = line.match(FULL_MATCH);
    if (lineMatch) {
        let object;
        let method;
        let functionName;
        let typeName;
        let methodName;
        if (lineMatch[1]) {
            functionName = lineMatch[1];
            let methodStart = functionName.lastIndexOf('.');
            if ('.' === functionName[methodStart - 1]) methodStart--;
            if (methodStart > 0) {
                object = functionName.slice(0, methodStart);
                method = functionName.slice(methodStart + 1);
                const objectEnd = object.indexOf('.Module');
                if (objectEnd > 0) {
                    functionName = functionName.slice(objectEnd + 1);
                    object = object.slice(0, objectEnd);
                }
            }
            typeName = void 0;
        }
        if (method) {
            typeName = object;
            methodName = method;
        }
        if ('<anonymous>' === method) {
            methodName = void 0;
            functionName = void 0;
        }
        if (void 0 === functionName) {
            methodName = methodName || external_base_js_namespaceObject.UNKNOWN_FUNCTION;
            functionName = typeName ? `${typeName}.${methodName}` : methodName;
        }
        let filename = lineMatch[2]?.startsWith('file://') ? lineMatch[2].slice(7) : lineMatch[2];
        const isNative = 'native' === lineMatch[5];
        if (filename?.match(/\/[A-Z]:/)) filename = filename.slice(1);
        if (!filename && lineMatch[5] && !isNative) filename = lineMatch[5];
        return {
            filename: filename ? decodeURI(filename) : void 0,
            module: void 0,
            function: functionName,
            lineno: _parseIntOrUndefined(lineMatch[3]),
            colno: _parseIntOrUndefined(lineMatch[4]),
            in_app: filenameIsInApp(filename || '', isNative),
            platform: "node:javascript"
        };
    }
    if (line.match(FILENAME_MATCH)) return {
        filename: line,
        platform: "node:javascript"
    };
};
function filenameIsInApp(filename, isNative = false) {
    const isInternal = isNative || filename && !filename.startsWith('/') && !filename.match(/^[A-Z]:/) && !filename.startsWith('.') && !filename.match(/^[a-zA-Z]([a-zA-Z0-9.\-+])*:\/\//);
    return !isInternal && void 0 !== filename && !filename.includes('node_modules/');
}
function _parseIntOrUndefined(input) {
    return parseInt(input || '', 10) || void 0;
}
exports.nodeStackLineParser = __webpack_exports__.nodeStackLineParser;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "nodeStackLineParser"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
