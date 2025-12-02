import { formatErrorMessage } from './format-error-message.mjs';

const warned = new Set();
function hasWarned(message) {
    return warned.has(message);
}
function warnOnce(condition, message, errorCode) {
    if (condition || warned.has(message))
        return;
    console.warn(formatErrorMessage(message, errorCode));
    warned.add(message);
}

export { hasWarned, warnOnce };
