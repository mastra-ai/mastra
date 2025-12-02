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
    opera11StackLineParser: ()=>opera11StackLineParser,
    opera10StackLineParser: ()=>opera10StackLineParser
});
const external_base_js_namespaceObject = require("./base.js");
const opera10Regex = / line (\d+).*script (?:in )?(\S+)(?:: in function (\S+))?$/i;
const opera10StackLineParser = (line)=>{
    const parts = opera10Regex.exec(line);
    return parts ? (0, external_base_js_namespaceObject.createFrame)(parts[2], parts[3] || external_base_js_namespaceObject.UNKNOWN_FUNCTION, +parts[1]) : void 0;
};
const opera11Regex = / line (\d+), column (\d+)\s*(?:in (?:<anonymous function: ([^>]+)>|([^)]+))\(.*\))? in (.*):\s*$/i;
const opera11StackLineParser = (line)=>{
    const parts = opera11Regex.exec(line);
    return parts ? (0, external_base_js_namespaceObject.createFrame)(parts[5], parts[3] || parts[4] || external_base_js_namespaceObject.UNKNOWN_FUNCTION, +parts[1], +parts[2]) : void 0;
};
exports.opera10StackLineParser = __webpack_exports__.opera10StackLineParser;
exports.opera11StackLineParser = __webpack_exports__.opera11StackLineParser;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "opera10StackLineParser",
    "opera11StackLineParser"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
