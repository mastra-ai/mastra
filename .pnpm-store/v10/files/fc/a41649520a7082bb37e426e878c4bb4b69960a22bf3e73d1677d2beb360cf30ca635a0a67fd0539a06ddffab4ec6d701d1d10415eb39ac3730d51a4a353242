import { CompiledQuery, DEFAULT_MIGRATION_LOCK_TABLE, DEFAULT_MIGRATION_TABLE, DefaultQueryCompiler, sql } from "kysely";

//#region src/adapters/kysely-adapter/bun-sqlite-dialect.ts
var BunSqliteAdapter = class {
	get supportsCreateIfNotExists() {
		return true;
	}
	get supportsTransactionalDdl() {
		return false;
	}
	get supportsReturning() {
		return true;
	}
	async acquireMigrationLock() {}
	async releaseMigrationLock() {}
	get supportsOutput() {
		return true;
	}
};
var BunSqliteDriver = class {
	#config;
	#connectionMutex = new ConnectionMutex();
	#db;
	#connection;
	constructor(config) {
		this.#config = { ...config };
	}
	async init() {
		this.#db = this.#config.database;
		this.#connection = new BunSqliteConnection(this.#db);
		if (this.#config.onCreateConnection) await this.#config.onCreateConnection(this.#connection);
	}
	async acquireConnection() {
		await this.#connectionMutex.lock();
		return this.#connection;
	}
	async beginTransaction(connection) {
		await connection.executeQuery(CompiledQuery.raw("begin"));
	}
	async commitTransaction(connection) {
		await connection.executeQuery(CompiledQuery.raw("commit"));
	}
	async rollbackTransaction(connection) {
		await connection.executeQuery(CompiledQuery.raw("rollback"));
	}
	async releaseConnection() {
		this.#connectionMutex.unlock();
	}
	async destroy() {
		this.#db?.close();
	}
};
var BunSqliteConnection = class {
	#db;
	constructor(db) {
		this.#db = db;
	}
	executeQuery(compiledQuery) {
		const { sql: sql$1, parameters } = compiledQuery;
		const stmt = this.#db.prepare(sql$1);
		return Promise.resolve({ rows: stmt.all(parameters) });
	}
	async *streamQuery() {
		throw new Error("Streaming query is not supported by SQLite driver.");
	}
};
var ConnectionMutex = class {
	#promise;
	#resolve;
	async lock() {
		while (this.#promise) await this.#promise;
		this.#promise = new Promise((resolve) => {
			this.#resolve = resolve;
		});
	}
	unlock() {
		const resolve = this.#resolve;
		this.#promise = void 0;
		this.#resolve = void 0;
		resolve?.();
	}
};
var BunSqliteIntrospector = class {
	#db;
	constructor(db) {
		this.#db = db;
	}
	async getSchemas() {
		return [];
	}
	async getTables(options = { withInternalKyselyTables: false }) {
		let query = this.#db.selectFrom("sqlite_schema").where("type", "=", "table").where("name", "not like", "sqlite_%").select("name").$castTo();
		if (!options.withInternalKyselyTables) query = query.where("name", "!=", DEFAULT_MIGRATION_TABLE).where("name", "!=", DEFAULT_MIGRATION_LOCK_TABLE);
		const tables = await query.execute();
		return Promise.all(tables.map(({ name }) => this.#getTableMetadata(name)));
	}
	async getMetadata(options) {
		return { tables: await this.getTables(options) };
	}
	async #getTableMetadata(table) {
		const db = this.#db;
		const autoIncrementCol = (await db.selectFrom("sqlite_master").where("name", "=", table).select("sql").$castTo().execute())[0]?.sql?.split(/[\(\),]/)?.find((it) => it.toLowerCase().includes("autoincrement"))?.split(/\s+/)?.[0]?.replace(/["`]/g, "");
		return {
			name: table,
			columns: (await db.selectFrom(sql`pragma_table_info(${table})`.as("table_info")).select([
				"name",
				"type",
				"notnull",
				"dflt_value"
			]).execute()).map((col) => ({
				name: col.name,
				dataType: col.type,
				isNullable: !col.notnull,
				isAutoIncrementing: col.name === autoIncrementCol,
				hasDefaultValue: col.dflt_value != null
			})),
			isView: true
		};
	}
};
var BunSqliteQueryCompiler = class extends DefaultQueryCompiler {
	getCurrentParameterPlaceholder() {
		return "?";
	}
	getLeftIdentifierWrapper() {
		return "\"";
	}
	getRightIdentifierWrapper() {
		return "\"";
	}
	getAutoIncrement() {
		return "autoincrement";
	}
};
var BunSqliteDialect = class {
	#config;
	constructor(config) {
		this.#config = { ...config };
	}
	createDriver() {
		return new BunSqliteDriver(this.#config);
	}
	createQueryCompiler() {
		return new BunSqliteQueryCompiler();
	}
	createAdapter() {
		return new BunSqliteAdapter();
	}
	createIntrospector(db) {
		return new BunSqliteIntrospector(db);
	}
};

//#endregion
export { BunSqliteDialect };