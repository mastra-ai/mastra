"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresAdapter = void 0;
const sql_js_1 = require("../../raw-builder/sql.js");
const dialect_adapter_base_js_1 = require("../dialect-adapter-base.js");
// Random id for our transaction lock.
const LOCK_ID = BigInt('3853314791062309107');
class PostgresAdapter extends dialect_adapter_base_js_1.DialectAdapterBase {
    get supportsTransactionalDdl() {
        return true;
    }
    get supportsReturning() {
        return true;
    }
    async acquireMigrationLock(db, _opt) {
        // Acquire a transaction level advisory lock.
        await (0, sql_js_1.sql) `select pg_advisory_xact_lock(${sql_js_1.sql.lit(LOCK_ID)})`.execute(db);
    }
    async releaseMigrationLock(_db, _opt) {
        // Nothing to do here. `pg_advisory_xact_lock` is automatically released at the
        // end of the transaction and since `supportsTransactionalDdl` true, we know
        // the `db` instance passed to acquireMigrationLock is actually a transaction.
    }
}
exports.PostgresAdapter = PostgresAdapter;
