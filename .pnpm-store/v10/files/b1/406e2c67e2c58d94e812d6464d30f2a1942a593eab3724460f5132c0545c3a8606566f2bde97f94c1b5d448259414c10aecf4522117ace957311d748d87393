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
    chromeStackLineParser: ()=>chromeStackLineParser
});
const external_base_js_namespaceObject = require("./base.js");
const external_safari_js_namespaceObject = require("./safari.js");
const chromeRegexNoFnName = /^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i;
const chromeRegex = /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
const chromeEvalRegex = /\((\S*)(?::(\d+))(?::(\d+))\)/;
const chromeStackLineParser = (line)=>{
    const noFnParts = chromeRegexNoFnName.exec(line);
    if (noFnParts) {
        const [, filename, line, col] = noFnParts;
        return (0, external_base_js_namespaceObject.createFrame)(filename, external_base_js_namespaceObject.UNKNOWN_FUNCTION, +line, +col);
    }
    const parts = chromeRegex.exec(line);
    if (parts) {
        const isEval = parts[2] && 0 === parts[2].indexOf('eval');
        if (isEval) {
            const subMatch = chromeEvalRegex.exec(parts[2]);
            if (subMatch) {
                parts[2] = subMatch[1];
                parts[3] = subMatch[2];
                parts[4] = subMatch[3];
            }
        }
        const [func, filename] = (0, external_safari_js_namespaceObject.extractSafariExtensionDetails)(parts[1] || external_base_js_namespaceObject.UNKNOWN_FUNCTION, parts[2]);
        return (0, external_base_js_namespaceObject.createFrame)(filename, func, parts[3] ? +parts[3] : void 0, parts[4] ? +parts[4] : void 0);
    }
};
exports.chromeStackLineParser = __webpack_exports__.chromeStackLineParser;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "chromeStackLineParser"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
