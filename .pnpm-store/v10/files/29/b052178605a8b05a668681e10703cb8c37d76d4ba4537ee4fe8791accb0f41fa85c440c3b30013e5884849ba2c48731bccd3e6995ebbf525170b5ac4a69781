/// <reference types="./postgres-adapter.d.ts" />
import { sql } from '../../raw-builder/sql.js';
import { DialectAdapterBase } from '../dialect-adapter-base.js';
// Random id for our transaction lock.
const LOCK_ID = BigInt('3853314791062309107');
export class PostgresAdapter extends DialectAdapterBase {
    get supportsTransactionalDdl() {
        return true;
    }
    get supportsReturning() {
        return true;
    }
    async acquireMigrationLock(db, _opt) {
        // Acquire a transaction level advisory lock.
        await sql `select pg_advisory_xact_lock(${sql.lit(LOCK_ID)})`.execute(db);
    }
    async releaseMigrationLock(_db, _opt) {
        // Nothing to do here. `pg_advisory_xact_lock` is automatically released at the
        // end of the transaction and since `supportsTransactionalDdl` true, we know
        // the `db` instance passed to acquireMigrationLock is actually a transaction.
    }
}
