import { UNKNOWN_FUNCTION, createFrame } from "./base.mjs";
const winjsRegex = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:[-a-z]+):.*?):(\d+)(?::(\d+))?\)?\s*$/i;
const winjsStackLineParser = (line)=>{
    const parts = winjsRegex.exec(line);
    return parts ? createFrame(parts[2], parts[1] || UNKNOWN_FUNCTION, +parts[3], parts[4] ? +parts[4] : void 0) : void 0;
};
export { winjsStackLineParser };
