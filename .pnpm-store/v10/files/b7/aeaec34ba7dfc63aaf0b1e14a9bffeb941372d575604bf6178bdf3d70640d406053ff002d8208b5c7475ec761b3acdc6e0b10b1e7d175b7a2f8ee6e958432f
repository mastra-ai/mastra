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
    getFilenameToChunkIdMap: ()=>getFilenameToChunkIdMap
});
let parsedStackResults;
let lastKeysCount;
let cachedFilenameChunkIds;
function getFilenameToChunkIdMap(stackParser) {
    const chunkIdMap = globalThis._posthogChunkIds;
    if (!chunkIdMap) return;
    const chunkIdKeys = Object.keys(chunkIdMap);
    if (cachedFilenameChunkIds && chunkIdKeys.length === lastKeysCount) return cachedFilenameChunkIds;
    lastKeysCount = chunkIdKeys.length;
    cachedFilenameChunkIds = chunkIdKeys.reduce((acc, stackKey)=>{
        if (!parsedStackResults) parsedStackResults = {};
        const result = parsedStackResults[stackKey];
        if (result) acc[result[0]] = result[1];
        else {
            const parsedStack = stackParser(stackKey);
            for(let i = parsedStack.length - 1; i >= 0; i--){
                const stackFrame = parsedStack[i];
                const filename = stackFrame?.filename;
                const chunkId = chunkIdMap[stackKey];
                if (filename && chunkId) {
                    acc[filename] = chunkId;
                    parsedStackResults[stackKey] = [
                        filename,
                        chunkId
                    ];
                    break;
                }
            }
        }
        return acc;
    }, {});
    return cachedFilenameChunkIds;
}
exports.getFilenameToChunkIdMap = __webpack_exports__.getFilenameToChunkIdMap;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "getFilenameToChunkIdMap"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
