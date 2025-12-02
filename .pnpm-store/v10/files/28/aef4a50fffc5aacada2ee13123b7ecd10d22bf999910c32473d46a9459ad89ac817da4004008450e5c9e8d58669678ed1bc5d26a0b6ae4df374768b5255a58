"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteAdapter = void 0;
const dialect_adapter_base_js_1 = require("../dialect-adapter-base.js");
class SqliteAdapter extends dialect_adapter_base_js_1.DialectAdapterBase {
    get supportsTransactionalDdl() {
        return false;
    }
    get supportsReturning() {
        return true;
    }
    async acquireMigrationLock(_db, _opt) {
        // SQLite only has one connection that's reserved by the migration system
        // for the whole time between acquireMigrationLock and releaseMigrationLock.
        // We don't need to do anything here.
    }
    async releaseMigrationLock(_db, _opt) {
        // SQLite only has one connection that's reserved by the migration system
        // for the whole time between acquireMigrationLock and releaseMigrationLock.
        // We don't need to do anything here.
    }
}
exports.SqliteAdapter = SqliteAdapter;
