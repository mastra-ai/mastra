import { formatErrorMessage } from './format-error-message.mjs';

let warning = () => { };
let invariant = () => { };
if (process.env.NODE_ENV !== "production") {
    warning = (check, message, errorCode) => {
        if (!check && typeof console !== "undefined") {
            console.warn(formatErrorMessage(message, errorCode));
        }
    };
    invariant = (check, message, errorCode) => {
        if (!check) {
            throw new Error(formatErrorMessage(message, errorCode));
        }
    };
}

export { invariant, warning };
