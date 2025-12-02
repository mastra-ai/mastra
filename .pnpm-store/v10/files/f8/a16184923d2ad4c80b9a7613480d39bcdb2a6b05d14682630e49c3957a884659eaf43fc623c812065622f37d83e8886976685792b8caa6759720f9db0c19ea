"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsMap = void 0;
class SettingsMap {
    constructor(record) {
        Object.defineProperty(this, "record", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: record
        });
    }
    toString() {
        return `{${Object.entries(this.record)
            .map(([k, v]) => `'${k}':'${v}'`)
            .join(',')}}`;
    }
    static from(record) {
        return new this(record);
    }
}
exports.SettingsMap = SettingsMap;
//# sourceMappingURL=settings.js.map