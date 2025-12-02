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
    createStackParser: ()=>createStackParser,
    winjsStackLineParser: ()=>external_winjs_js_namespaceObject.winjsStackLineParser,
    nodeStackLineParser: ()=>external_node_js_namespaceObject.nodeStackLineParser,
    geckoStackLineParser: ()=>external_gecko_js_namespaceObject.geckoStackLineParser,
    opera10StackLineParser: ()=>external_opera_js_namespaceObject.opera10StackLineParser,
    opera11StackLineParser: ()=>external_opera_js_namespaceObject.opera11StackLineParser,
    chromeStackLineParser: ()=>external_chrome_js_namespaceObject.chromeStackLineParser,
    reverseAndStripFrames: ()=>reverseAndStripFrames
});
const external_base_js_namespaceObject = require("./base.js");
const external_chrome_js_namespaceObject = require("./chrome.js");
const external_winjs_js_namespaceObject = require("./winjs.js");
const external_gecko_js_namespaceObject = require("./gecko.js");
const external_opera_js_namespaceObject = require("./opera.js");
const external_node_js_namespaceObject = require("./node.js");
const WEBPACK_ERROR_REGEXP = /\(error: (.*)\)/;
const STACKTRACE_FRAME_LIMIT = 50;
function reverseAndStripFrames(stack) {
    if (!stack.length) return [];
    const localStack = Array.from(stack);
    localStack.reverse();
    return localStack.slice(0, STACKTRACE_FRAME_LIMIT).map((frame)=>({
            ...frame,
            filename: frame.filename || getLastStackFrame(localStack).filename,
            function: frame.function || external_base_js_namespaceObject.UNKNOWN_FUNCTION
        }));
}
function getLastStackFrame(arr) {
    return arr[arr.length - 1] || {};
}
function createStackParser(...parsers) {
    return (stack, skipFirstLines = 0)=>{
        const frames = [];
        const lines = stack.split('\n');
        for(let i = skipFirstLines; i < lines.length; i++){
            const line = lines[i];
            if (line.length > 1024) continue;
            const cleanedLine = WEBPACK_ERROR_REGEXP.test(line) ? line.replace(WEBPACK_ERROR_REGEXP, '$1') : line;
            if (!cleanedLine.match(/\S*Error: /)) {
                for (const parser of parsers){
                    const frame = parser(cleanedLine);
                    if (frame) {
                        frames.push(frame);
                        break;
                    }
                }
                if (frames.length >= STACKTRACE_FRAME_LIMIT) break;
            }
        }
        return reverseAndStripFrames(frames);
    };
}
exports.chromeStackLineParser = __webpack_exports__.chromeStackLineParser;
exports.createStackParser = __webpack_exports__.createStackParser;
exports.geckoStackLineParser = __webpack_exports__.geckoStackLineParser;
exports.nodeStackLineParser = __webpack_exports__.nodeStackLineParser;
exports.opera10StackLineParser = __webpack_exports__.opera10StackLineParser;
exports.opera11StackLineParser = __webpack_exports__.opera11StackLineParser;
exports.reverseAndStripFrames = __webpack_exports__.reverseAndStripFrames;
exports.winjsStackLineParser = __webpack_exports__.winjsStackLineParser;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "chromeStackLineParser",
    "createStackParser",
    "geckoStackLineParser",
    "nodeStackLineParser",
    "opera10StackLineParser",
    "opera11StackLineParser",
    "reverseAndStripFrames",
    "winjsStackLineParser"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
