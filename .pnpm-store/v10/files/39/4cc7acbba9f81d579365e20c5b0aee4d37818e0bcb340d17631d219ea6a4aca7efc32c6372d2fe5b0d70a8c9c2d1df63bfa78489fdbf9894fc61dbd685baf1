import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
export function secondsToTimestamp(seconds, format = "HH:mm:ss.SSS") {
    return dayjs(seconds * 1000)
        .utc()
        .format(format);
}
export function chunkArray(arr, length) {
    const res = [];
    for (let i = 0; i < arr.length; i += length) {
        const chunkarr = arr.slice(i, i + length);
        res.push(chunkarr);
    }
    return res;
}
//# sourceMappingURL=helpers.js.map