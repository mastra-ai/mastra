import { UNKNOWN_FUNCTION } from "./base.mjs";
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
            methodName = methodName || UNKNOWN_FUNCTION;
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
export { nodeStackLineParser };
