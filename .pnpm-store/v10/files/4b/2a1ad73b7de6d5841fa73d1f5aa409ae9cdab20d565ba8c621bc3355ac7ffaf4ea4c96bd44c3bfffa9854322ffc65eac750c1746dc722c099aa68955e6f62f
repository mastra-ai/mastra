import { UNKNOWN_FUNCTION, createFrame } from "./base.mjs";
import { extractSafariExtensionDetails } from "./safari.mjs";
const geckoREgex = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i;
const geckoEvalRegex = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
const geckoStackLineParser = (line)=>{
    const parts = geckoREgex.exec(line);
    if (parts) {
        const isEval = parts[3] && parts[3].indexOf(' > eval') > -1;
        if (isEval) {
            const subMatch = geckoEvalRegex.exec(parts[3]);
            if (subMatch) {
                parts[1] = parts[1] || 'eval';
                parts[3] = subMatch[1];
                parts[4] = subMatch[2];
                parts[5] = '';
            }
        }
        let filename = parts[3];
        let func = parts[1] || UNKNOWN_FUNCTION;
        [func, filename] = extractSafariExtensionDetails(func, filename);
        return createFrame(filename, func, parts[4] ? +parts[4] : void 0, parts[5] ? +parts[5] : void 0);
    }
};
export { geckoStackLineParser };
