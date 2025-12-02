function cloneRegExp(re) {
    var _a;
    const regexMatch = /^\/(.*)\/([gimyu]*)$/.exec(re.toString());
    if (!regexMatch) {
        throw new Error("Invalid RegExp");
    }
    return new RegExp((_a = regexMatch[1]) !== null && _a !== void 0 ? _a : "", regexMatch[2]);
}
export default function clone(arg) {
    if (typeof arg !== "object") {
        return arg;
    }
    if (arg === null) {
        return null;
    }
    if (Array.isArray(arg)) {
        return arg.map(clone);
    }
    if (arg instanceof Date) {
        return new Date(arg.getTime());
    }
    if (arg instanceof RegExp) {
        return cloneRegExp(arg);
    }
    const cloned = {};
    for (const name in arg) {
        if (Object.prototype.hasOwnProperty.call(arg, name)) {
            cloned[name] = clone(arg[name]);
        }
    }
    return cloned;
}
