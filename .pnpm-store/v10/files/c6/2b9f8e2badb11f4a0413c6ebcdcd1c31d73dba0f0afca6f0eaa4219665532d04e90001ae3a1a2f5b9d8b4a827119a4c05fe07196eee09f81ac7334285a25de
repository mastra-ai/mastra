import { UNKNOWN_FUNCTION, createFrame } from "./base.mjs";
import { extractSafariExtensionDetails } from "./safari.mjs";
const chromeRegexNoFnName = /^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i;
const chromeRegex = /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
const chromeEvalRegex = /\((\S*)(?::(\d+))(?::(\d+))\)/;
const chromeStackLineParser = (line)=>{
    const noFnParts = chromeRegexNoFnName.exec(line);
    if (noFnParts) {
        const [, filename, line, col] = noFnParts;
        return createFrame(filename, UNKNOWN_FUNCTION, +line, +col);
    }
    const parts = chromeRegex.exec(line);
    if (parts) {
        const isEval = parts[2] && 0 === parts[2].indexOf('eval');
        if (isEval) {
            const subMatch = chromeEvalRegex.exec(parts[2]);
            if (subMatch) {
                parts[2] = subMatch[1];
                parts[3] = subMatch[2];
                parts[4] = subMatch[3];
            }
        }
        const [func, filename] = extractSafariExtensionDetails(parts[1] || UNKNOWN_FUNCTION, parts[2]);
        return createFrame(filename, func, parts[3] ? +parts[3] : void 0, parts[4] ? +parts[4] : void 0);
    }
};
export { chromeStackLineParser };
