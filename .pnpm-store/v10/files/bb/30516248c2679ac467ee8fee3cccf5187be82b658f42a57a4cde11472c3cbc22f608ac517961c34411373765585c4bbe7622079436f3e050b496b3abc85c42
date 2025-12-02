"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkArray = exports.secondsToTimestamp = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
dayjs_1.default.extend(utc_1.default);
function secondsToTimestamp(seconds, format = "HH:mm:ss.SSS") {
    return (0, dayjs_1.default)(seconds * 1000)
        .utc()
        .format(format);
}
exports.secondsToTimestamp = secondsToTimestamp;
function chunkArray(arr, length) {
    const res = [];
    for (let i = 0; i < arr.length; i += length) {
        const chunkarr = arr.slice(i, i + length);
        res.push(chunkarr);
    }
    return res;
}
exports.chunkArray = chunkArray;
//# sourceMappingURL=helpers.js.map