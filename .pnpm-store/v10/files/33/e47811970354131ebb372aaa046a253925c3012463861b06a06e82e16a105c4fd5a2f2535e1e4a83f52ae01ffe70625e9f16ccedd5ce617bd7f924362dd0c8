import { UNKNOWN_FUNCTION, createFrame } from "./base.mjs";
const opera10Regex = / line (\d+).*script (?:in )?(\S+)(?:: in function (\S+))?$/i;
const opera10StackLineParser = (line)=>{
    const parts = opera10Regex.exec(line);
    return parts ? createFrame(parts[2], parts[3] || UNKNOWN_FUNCTION, +parts[1]) : void 0;
};
const opera11Regex = / line (\d+), column (\d+)\s*(?:in (?:<anonymous function: ([^>]+)>|([^)]+))\(.*\))? in (.*):\s*$/i;
const opera11StackLineParser = (line)=>{
    const parts = opera11Regex.exec(line);
    return parts ? createFrame(parts[5], parts[3] || parts[4] || UNKNOWN_FUNCTION, +parts[1], +parts[2]) : void 0;
};
export { opera10StackLineParser, opera11StackLineParser };
