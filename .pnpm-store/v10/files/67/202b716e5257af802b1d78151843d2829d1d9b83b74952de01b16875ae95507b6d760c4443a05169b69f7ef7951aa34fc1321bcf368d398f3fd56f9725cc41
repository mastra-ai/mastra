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
    geckoStackLineParser: ()=>geckoStackLineParser
});
const external_base_js_namespaceObject = require("./base.js");
const external_safari_js_namespaceObject = require("./safari.js");
const geckoREgex = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i;
const geckoEvalRegex = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
const geckoStackLineParser = (line)=>{
    const parts = geckoREgex.exec(line);
    if (parts) {
        const isEval = parts[3] && parts[3].indexOf(' > eval') > -1;
        if (isEval) {
            const subMatch = geckoEvalRegex.exec(parts[3]);
            if (subMatch) {
                parts[1] = parts[1] || 'eval';
                parts[3] = subMatch[1];
                parts[4] = subMatch[2];
                parts[5] = '';
            }
        }
        let filename = parts[3];
        let func = parts[1] || external_base_js_namespaceObject.UNKNOWN_FUNCTION;
        [func, filename] = (0, external_safari_js_namespaceObject.extractSafariExtensionDetails)(func, filename);
        return (0, external_base_js_namespaceObject.createFrame)(filename, func, parts[4] ? +parts[4] : void 0, parts[5] ? +parts[5] : void 0);
    }
};
exports.geckoStackLineParser = __webpack_exports__.geckoStackLineParser;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "geckoStackLineParser"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
