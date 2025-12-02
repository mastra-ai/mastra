"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MysqlAdapter = void 0;
const sql_js_1 = require("../../raw-builder/sql.js");
const dialect_adapter_base_js_1 = require("../dialect-adapter-base.js");
const LOCK_ID = 'ea586330-2c93-47c8-908d-981d9d270f9d';
const LOCK_TIMEOUT_SECONDS = 60 * 60;
class MysqlAdapter extends dialect_adapter_base_js_1.DialectAdapterBase {
    get supportsTransactionalDdl() {
        return false;
    }
    get supportsReturning() {
        return false;
    }
    async acquireMigrationLock(db, _opt) {
        // Kysely uses a single connection to run the migrations. Because of that, we
        // can take a lock using `get_lock`. Locks acquired using `get_lock` get
        // released when the connection is destroyed (session ends) or when the lock
        // is released using `release_lock`. This way we know that the lock is either
        // released by us after successfull or failed migrations OR it's released by
        // MySQL if the process gets killed for some reason.
        await (0, sql_js_1.sql) `select get_lock(${sql_js_1.sql.lit(LOCK_ID)}, ${sql_js_1.sql.lit(LOCK_TIMEOUT_SECONDS)})`.execute(db);
    }
    async releaseMigrationLock(db, _opt) {
        await (0, sql_js_1.sql) `select release_lock(${sql_js_1.sql.lit(LOCK_ID)})`.execute(db);
    }
}
exports.MysqlAdapter = MysqlAdapter;
