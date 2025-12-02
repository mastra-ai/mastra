// use as 2nd parameter for JSON.parse to revive Date instances
export default function dateReviver(_key, value) {
    var _a, _b, _c, _d, _e, _f;
    if (typeof value !== "string") {
        return value;
    }
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d*))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
    if (!parts) {
        return value;
    }
    return new Date(Date.UTC(Number.parseInt((_a = parts[1]) !== null && _a !== void 0 ? _a : "0", 10), Number.parseInt((_b = parts[2]) !== null && _b !== void 0 ? _b : "0", 10) - 1, Number.parseInt((_c = parts[3]) !== null && _c !== void 0 ? _c : "0", 10), Number.parseInt((_d = parts[4]) !== null && _d !== void 0 ? _d : "0", 10), Number.parseInt((_e = parts[5]) !== null && _e !== void 0 ? _e : "0", 10), Number.parseInt((_f = parts[6]) !== null && _f !== void 0 ? _f : "0", 10), (parts[7] ? Number.parseInt(parts[7]) : 0) || 0));
}
