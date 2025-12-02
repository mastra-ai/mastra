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
    MAX_CONTEXTLINES_LINENO: ()=>MAX_CONTEXTLINES_LINENO,
    MAX_CONTEXTLINES_COLNO: ()=>MAX_CONTEXTLINES_COLNO,
    addSourceContext: ()=>addSourceContext
});
const core_namespaceObject = require("@posthog/core");
const external_node_fs_namespaceObject = require("node:fs");
const external_node_readline_namespaceObject = require("node:readline");
const LRU_FILE_CONTENTS_CACHE = new core_namespaceObject.ErrorTracking.ReduceableCache(25);
const LRU_FILE_CONTENTS_FS_READ_FAILED = new core_namespaceObject.ErrorTracking.ReduceableCache(20);
const DEFAULT_LINES_OF_CONTEXT = 7;
const MAX_CONTEXTLINES_COLNO = 1000;
const MAX_CONTEXTLINES_LINENO = 10000;
async function addSourceContext(frames) {
    const filesToLines = {};
    for(let i = frames.length - 1; i >= 0; i--){
        const frame = frames[i];
        const filename = frame?.filename;
        if (!frame || 'string' != typeof filename || 'number' != typeof frame.lineno || shouldSkipContextLinesForFile(filename) || shouldSkipContextLinesForFrame(frame)) continue;
        const filesToLinesOutput = filesToLines[filename];
        if (!filesToLinesOutput) filesToLines[filename] = [];
        filesToLines[filename].push(frame.lineno);
    }
    const files = Object.keys(filesToLines);
    if (0 == files.length) return frames;
    const readlinePromises = [];
    for (const file of files){
        if (LRU_FILE_CONTENTS_FS_READ_FAILED.get(file)) continue;
        const filesToLineRanges = filesToLines[file];
        if (!filesToLineRanges) continue;
        filesToLineRanges.sort((a, b)=>a - b);
        const ranges = makeLineReaderRanges(filesToLineRanges);
        if (ranges.every((r)=>rangeExistsInContentCache(file, r))) continue;
        const cache = emplace(LRU_FILE_CONTENTS_CACHE, file, {});
        readlinePromises.push(getContextLinesFromFile(file, ranges, cache));
    }
    await Promise.all(readlinePromises).catch(()=>{});
    if (frames && frames.length > 0) addSourceContextToFrames(frames, LRU_FILE_CONTENTS_CACHE);
    LRU_FILE_CONTENTS_CACHE.reduce();
    return frames;
}
function getContextLinesFromFile(path, ranges, output) {
    return new Promise((resolve)=>{
        const stream = (0, external_node_fs_namespaceObject.createReadStream)(path);
        const lineReaded = (0, external_node_readline_namespaceObject.createInterface)({
            input: stream
        });
        function destroyStreamAndResolve() {
            stream.destroy();
            resolve();
        }
        let lineNumber = 0;
        let currentRangeIndex = 0;
        const range = ranges[currentRangeIndex];
        if (void 0 === range) return void destroyStreamAndResolve();
        let rangeStart = range[0];
        let rangeEnd = range[1];
        function onStreamError() {
            LRU_FILE_CONTENTS_FS_READ_FAILED.set(path, 1);
            lineReaded.close();
            lineReaded.removeAllListeners();
            destroyStreamAndResolve();
        }
        stream.on('error', onStreamError);
        lineReaded.on('error', onStreamError);
        lineReaded.on('close', destroyStreamAndResolve);
        lineReaded.on('line', (line)=>{
            lineNumber++;
            if (lineNumber < rangeStart) return;
            output[lineNumber] = snipLine(line, 0);
            if (lineNumber >= rangeEnd) {
                if (currentRangeIndex === ranges.length - 1) {
                    lineReaded.close();
                    lineReaded.removeAllListeners();
                    return;
                }
                currentRangeIndex++;
                const range = ranges[currentRangeIndex];
                if (void 0 === range) {
                    lineReaded.close();
                    lineReaded.removeAllListeners();
                    return;
                }
                rangeStart = range[0];
                rangeEnd = range[1];
            }
        });
    });
}
function addSourceContextToFrames(frames, cache) {
    for (const frame of frames)if (frame.filename && void 0 === frame.context_line && 'number' == typeof frame.lineno) {
        const contents = cache.get(frame.filename);
        if (void 0 === contents) continue;
        addContextToFrame(frame.lineno, frame, contents);
    }
}
function addContextToFrame(lineno, frame, contents) {
    if (void 0 === frame.lineno || void 0 === contents) return;
    frame.pre_context = [];
    for(let i = makeRangeStart(lineno); i < lineno; i++){
        const line = contents[i];
        if (void 0 === line) return void clearLineContext(frame);
        frame.pre_context.push(line);
    }
    if (void 0 === contents[lineno]) return void clearLineContext(frame);
    frame.context_line = contents[lineno];
    const end = makeRangeEnd(lineno);
    frame.post_context = [];
    for(let i = lineno + 1; i <= end; i++){
        const line = contents[i];
        if (void 0 === line) break;
        frame.post_context.push(line);
    }
}
function clearLineContext(frame) {
    delete frame.pre_context;
    delete frame.context_line;
    delete frame.post_context;
}
function shouldSkipContextLinesForFile(path) {
    return path.startsWith('node:') || path.endsWith('.min.js') || path.endsWith('.min.cjs') || path.endsWith('.min.mjs') || path.startsWith('data:');
}
function shouldSkipContextLinesForFrame(frame) {
    if (void 0 !== frame.lineno && frame.lineno > MAX_CONTEXTLINES_LINENO) return true;
    if (void 0 !== frame.colno && frame.colno > MAX_CONTEXTLINES_COLNO) return true;
    return false;
}
function rangeExistsInContentCache(file, range) {
    const contents = LRU_FILE_CONTENTS_CACHE.get(file);
    if (void 0 === contents) return false;
    for(let i = range[0]; i <= range[1]; i++)if (void 0 === contents[i]) return false;
    return true;
}
function makeLineReaderRanges(lines) {
    if (!lines.length) return [];
    let i = 0;
    const line = lines[0];
    if ('number' != typeof line) return [];
    let current = makeContextRange(line);
    const out = [];
    while(true){
        if (i === lines.length - 1) {
            out.push(current);
            break;
        }
        const next = lines[i + 1];
        if ('number' != typeof next) break;
        if (next <= current[1]) current[1] = next + DEFAULT_LINES_OF_CONTEXT;
        else {
            out.push(current);
            current = makeContextRange(next);
        }
        i++;
    }
    return out;
}
function makeContextRange(line) {
    return [
        makeRangeStart(line),
        makeRangeEnd(line)
    ];
}
function makeRangeStart(line) {
    return Math.max(1, line - DEFAULT_LINES_OF_CONTEXT);
}
function makeRangeEnd(line) {
    return line + DEFAULT_LINES_OF_CONTEXT;
}
function emplace(map, key, contents) {
    const value = map.get(key);
    if (void 0 === value) {
        map.set(key, contents);
        return contents;
    }
    return value;
}
function snipLine(line, colno) {
    let newLine = line;
    const lineLength = newLine.length;
    if (lineLength <= 150) return newLine;
    if (colno > lineLength) colno = lineLength;
    let start = Math.max(colno - 60, 0);
    if (start < 5) start = 0;
    let end = Math.min(start + 140, lineLength);
    if (end > lineLength - 5) end = lineLength;
    if (end === lineLength) start = Math.max(end - 140, 0);
    newLine = newLine.slice(start, end);
    if (start > 0) newLine = `...${newLine}`;
    if (end < lineLength) newLine += '...';
    return newLine;
}
exports.MAX_CONTEXTLINES_COLNO = __webpack_exports__.MAX_CONTEXTLINES_COLNO;
exports.MAX_CONTEXTLINES_LINENO = __webpack_exports__.MAX_CONTEXTLINES_LINENO;
exports.addSourceContext = __webpack_exports__.addSourceContext;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "MAX_CONTEXTLINES_COLNO",
    "MAX_CONTEXTLINES_LINENO",
    "addSourceContext"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
