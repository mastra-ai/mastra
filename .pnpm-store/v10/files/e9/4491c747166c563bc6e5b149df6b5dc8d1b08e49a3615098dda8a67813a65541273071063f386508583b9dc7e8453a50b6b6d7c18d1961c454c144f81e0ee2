import { UNKNOWN_FUNCTION } from "./base.mjs";
const extractSafariExtensionDetails = (func, filename)=>{
    const isSafariExtension = -1 !== func.indexOf('safari-extension');
    const isSafariWebExtension = -1 !== func.indexOf('safari-web-extension');
    return isSafariExtension || isSafariWebExtension ? [
        -1 !== func.indexOf('@') ? func.split('@')[0] : UNKNOWN_FUNCTION,
        isSafariExtension ? `safari-extension:${filename}` : `safari-web-extension:${filename}`
    ] : [
        func,
        filename
    ];
};
export { extractSafariExtensionDetails };
