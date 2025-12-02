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
    ErrorPropertiesBuilder: ()=>ErrorPropertiesBuilder
});
const index_js_namespaceObject = require("../utils/index.js");
const external_chunk_ids_js_namespaceObject = require("./chunk-ids.js");
const external_parsers_index_js_namespaceObject = require("./parsers/index.js");
const MAX_CAUSE_RECURSION = 4;
class ErrorPropertiesBuilder {
    constructor(coercers = [], parsers = [], modifiers = []){
        this.coercers = coercers;
        this.modifiers = modifiers;
        this.stackParser = (0, external_parsers_index_js_namespaceObject.createStackParser)(...parsers);
    }
    buildFromUnknown(input, hint = {}) {
        const providedMechanism = hint && hint.mechanism;
        const mechanism = providedMechanism || {
            handled: true,
            type: 'generic'
        };
        const coercingContext = this.buildCoercingContext(mechanism, hint, 0);
        const exceptionWithCause = coercingContext.apply(input);
        const parsingContext = this.buildParsingContext();
        const exceptionWithStack = this.parseStacktrace(exceptionWithCause, parsingContext);
        const exceptionList = this.convertToExceptionList(exceptionWithStack, mechanism);
        return {
            $exception_list: exceptionList,
            $exception_level: 'error'
        };
    }
    async modifyFrames(exceptionList) {
        for (const exc of exceptionList)if (exc.stacktrace && exc.stacktrace.frames && (0, index_js_namespaceObject.isArray)(exc.stacktrace.frames)) exc.stacktrace.frames = await this.applyModifiers(exc.stacktrace.frames);
        return exceptionList;
    }
    coerceFallback(ctx) {
        return {
            type: 'Error',
            value: 'Unknown error',
            stack: ctx.syntheticException?.stack,
            synthetic: true
        };
    }
    parseStacktrace(err, ctx) {
        let cause;
        if (null != err.cause) cause = this.parseStacktrace(err.cause, ctx);
        let stack;
        if ('' != err.stack && null != err.stack) stack = this.applyChunkIds(this.stackParser(err.stack, err.synthetic ? 1 : 0), ctx.chunkIdMap);
        return {
            ...err,
            cause,
            stack
        };
    }
    applyChunkIds(frames, chunkIdMap) {
        return frames.map((frame)=>{
            if (frame.filename && chunkIdMap) frame.chunk_id = chunkIdMap[frame.filename];
            return frame;
        });
    }
    applyCoercers(input, ctx) {
        for (const adapter of this.coercers)if (adapter.match(input)) return adapter.coerce(input, ctx);
        return this.coerceFallback(ctx);
    }
    async applyModifiers(frames) {
        let newFrames = frames;
        for (const modifier of this.modifiers)newFrames = await modifier(newFrames);
        return newFrames;
    }
    convertToExceptionList(exceptionWithStack, mechanism) {
        const currentException = {
            type: exceptionWithStack.type,
            value: exceptionWithStack.value,
            mechanism: {
                type: mechanism.type ?? 'generic',
                handled: mechanism.handled ?? true,
                synthetic: exceptionWithStack.synthetic ?? false
            }
        };
        if (exceptionWithStack.stack) currentException.stacktrace = {
            type: 'raw',
            frames: exceptionWithStack.stack
        };
        const exceptionList = [
            currentException
        ];
        if (null != exceptionWithStack.cause) exceptionList.push(...this.convertToExceptionList(exceptionWithStack.cause, {
            ...mechanism,
            handled: true
        }));
        return exceptionList;
    }
    buildParsingContext() {
        const context = {
            chunkIdMap: (0, external_chunk_ids_js_namespaceObject.getFilenameToChunkIdMap)(this.stackParser)
        };
        return context;
    }
    buildCoercingContext(mechanism, hint, depth = 0) {
        const coerce = (input, depth)=>{
            if (!(depth <= MAX_CAUSE_RECURSION)) return;
            {
                const ctx = this.buildCoercingContext(mechanism, hint, depth);
                return this.applyCoercers(input, ctx);
            }
        };
        const context = {
            ...hint,
            syntheticException: 0 == depth ? hint.syntheticException : void 0,
            mechanism,
            apply: (input)=>coerce(input, depth),
            next: (input)=>coerce(input, depth + 1)
        };
        return context;
    }
}
exports.ErrorPropertiesBuilder = __webpack_exports__.ErrorPropertiesBuilder;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "ErrorPropertiesBuilder"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
