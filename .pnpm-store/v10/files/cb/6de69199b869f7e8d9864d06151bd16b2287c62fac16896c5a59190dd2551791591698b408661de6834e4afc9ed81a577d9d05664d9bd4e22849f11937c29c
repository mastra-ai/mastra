"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialectAdapterBase = void 0;
/**
 * A basic implementation of `DialectAdapter` with sensible default values.
 * Third-party dialects can extend this instead of implementing the `DialectAdapter`
 * interface from scratch. That way all new settings will get default values when
 * they are added and there will be less breaking changes.
 */
class DialectAdapterBase {
    get supportsCreateIfNotExists() {
        return true;
    }
    get supportsTransactionalDdl() {
        return false;
    }
    get supportsReturning() {
        return false;
    }
    get supportsOutput() {
        return false;
    }
}
exports.DialectAdapterBase = DialectAdapterBase;
