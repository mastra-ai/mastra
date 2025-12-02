import { isUndefined } from "../../utils/index.mjs";
const UNKNOWN_FUNCTION = '?';
function createFrame(filename, func, lineno, colno) {
    const frame = {
        platform: "web:javascript",
        filename,
        function: '<anonymous>' === func ? UNKNOWN_FUNCTION : func,
        in_app: true
    };
    if (!isUndefined(lineno)) frame.lineno = lineno;
    if (!isUndefined(colno)) frame.colno = colno;
    return frame;
}
export { UNKNOWN_FUNCTION, createFrame };
