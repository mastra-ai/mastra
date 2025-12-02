"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bufferTextMapGetter = void 0;
/*
same as open telemetry's `defaultTextMapGetter`,
but also handle case where header is buffer,
adding toString() to make sure string is returned
*/
exports.bufferTextMapGetter = {
    get(carrier, key) {
        var _a;
        if (!carrier) {
            return undefined;
        }
        const keys = Object.keys(carrier);
        for (const carrierKey of keys) {
            if (carrierKey === key || carrierKey.toLowerCase() === key) {
                return (_a = carrier[carrierKey]) === null || _a === void 0 ? void 0 : _a.toString();
            }
        }
        return undefined;
    },
    keys(carrier) {
        return carrier ? Object.keys(carrier) : [];
    },
};
//# sourceMappingURL=propagator.js.map