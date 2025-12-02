import { UNKNOWN_FUNCTION } from "./base.mjs";
import { chromeStackLineParser } from "./chrome.mjs";
import { winjsStackLineParser } from "./winjs.mjs";
import { geckoStackLineParser } from "./gecko.mjs";
import { opera10StackLineParser, opera11StackLineParser } from "./opera.mjs";
import { nodeStackLineParser } from "./node.mjs";
const WEBPACK_ERROR_REGEXP = /\(error: (.*)\)/;
const STACKTRACE_FRAME_LIMIT = 50;
function reverseAndStripFrames(stack) {
    if (!stack.length) return [];
    const localStack = Array.from(stack);
    localStack.reverse();
    return localStack.slice(0, STACKTRACE_FRAME_LIMIT).map((frame)=>({
            ...frame,
            filename: frame.filename || getLastStackFrame(localStack).filename,
            function: frame.function || UNKNOWN_FUNCTION
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
export { chromeStackLineParser, createStackParser, geckoStackLineParser, nodeStackLineParser, opera10StackLineParser, opera11StackLineParser, reverseAndStripFrames, winjsStackLineParser };
