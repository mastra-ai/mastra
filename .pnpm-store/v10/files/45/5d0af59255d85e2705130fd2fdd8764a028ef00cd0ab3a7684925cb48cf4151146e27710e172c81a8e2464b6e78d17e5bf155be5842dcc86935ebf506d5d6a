"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var long_exports = {};
__export(long_exports, {
  Long: () => Long
});
module.exports = __toCommonJS(long_exports);
class Long {
  constructor(low, high) {
    __publicField(this, "low");
    __publicField(this, "high");
    __publicField(this, "__isUnsignedLong__");
    this.low = low | 0;
    this.high = high | 0;
    this.__isUnsignedLong__ = true;
  }
  static isLong(obj) {
    return (obj && obj.__isUnsignedLong__) === true;
  }
  // prettier-ignore
  static fromBytesLE(bytes) {
    return new Long(
      bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24,
      bytes[4] | bytes[5] << 8 | bytes[6] << 16 | bytes[7] << 24
    );
  }
  // prettier-ignore
  toBytesLE() {
    const hi = this.high;
    const lo = this.low;
    return [
      lo & 255,
      lo >>> 8 & 255,
      lo >>> 16 & 255,
      lo >>> 24,
      hi & 255,
      hi >>> 8 & 255,
      hi >>> 16 & 255,
      hi >>> 24
    ];
  }
  static fromNumber(value) {
    if (isNaN(value)) return UZERO;
    if (value < 0) return UZERO;
    if (value >= TWO_PWR_64_DBL) return MAX_UNSIGNED_VALUE;
    return new Long(value % TWO_PWR_32_DBL | 0, value / TWO_PWR_32_DBL | 0);
  }
  toString() {
    return (BigInt(this.high) * BigInt(TWO_PWR_32_DBL) + BigInt(this.low)).toString();
  }
  equals(other) {
    if (!Long.isLong(other)) other = Long.fromValue(other);
    if (this.high >>> 31 === 1 && other.high >>> 31 === 1) return false;
    return this.high === other.high && this.low === other.low;
  }
  notEquals(other) {
    return !this.equals(other);
  }
  comp(other) {
    if (!Long.isLong(other)) other = Long.fromValue(other);
    if (this.equals(other)) return 0;
    return other.high >>> 0 > this.high >>> 0 || other.high === this.high && other.low >>> 0 > this.low >>> 0 ? -1 : 1;
  }
  lessThanOrEqual(other) {
    return this.comp(
      /* validates */
      other
    ) <= 0;
  }
  static fromValue(val) {
    if (typeof val === "number") return Long.fromNumber(val);
    return new Long(val.low, val.high);
  }
}
const UZERO = new Long(0, 0);
const TWO_PWR_16_DBL = 1 << 16;
const TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
const TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;
const MAX_UNSIGNED_VALUE = new Long(4294967295 | 0, 4294967295 | 0);
//# sourceMappingURL=long.js.map
