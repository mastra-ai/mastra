import { GenericId } from "../values/index.js";
import { DocumentByName, GenericDataModel, NamedTableInfo, TableNamesInDataModel } from "./data_model.js";
import { QueryInitializer } from "./query.js";
import { SystemDataModel } from "./schema.js";
import { WithOptionalSystemFields, WithoutSystemFields } from "./system_fields.js";
interface BaseDatabaseReader<DataModel extends GenericDataModel> {
    /**
     * Fetch a single document from the database by its {@link values.GenericId}.
     *
     * @param id - The {@link values.GenericId} of the document to fetch from the database.
     * @returns - The {@link GenericDocument} of the document at the given {@link values.GenericId}, or `null` if it no longer exists.
     */
    get<TableName extends TableNamesInDataModel<DataModel>>(id: GenericId<TableName>): Promise<DocumentByName<DataModel, TableName> | null>;
    /**
     * Begin a query for the given table name.
     *
     * Queries don't execute immediately, so calling this method and extending its
     * query are free until the results are actually used.
     *
     * @param tableName - The name of the table to query.
     * @returns - A {@link QueryInitializer} object to start building a query.
     */
    query<TableName extends TableNamesInDataModel<DataModel>>(tableName: TableName): QueryInitializer<NamedTableInfo<DataModel, TableName>>;
    /**
     * Returns the string ID format for the ID in a given table, or null if the ID
     * is from a different table or is not a valid ID.
     *
     * This accepts the string ID format as well as the `.toString()` representation
     * of the legacy class-based ID format.
     *
     * This does not guarantee that the ID exists (i.e. `db.get(id)` may return `null`).
     *
     * @param tableName - The name of the table.
     * @param id - The ID string.
     */
    normalizeId<TableName extends TableNamesInDataModel<DataModel>>(tableName: TableName, id: string): GenericId<TableName> | null;
}
interface BaseDatabaseReaderWithTable<DataModel extends GenericDataModel> {
    /**
     * Scope the database to a specific table.
     */
    table<TableName extends TableNamesInDataModel<DataModel>>(tableName: TableName): BaseTableReader<DataModel, TableName>;
}
export interface BaseTableReader<DataModel extends GenericDataModel, TableName extends TableNamesInDataModel<DataModel>> {
    /**
     * Fetch a single document from the table by its {@link values.GenericId}.
     *
     * @param id - The {@link values.GenericId} of the document to fetch from the database.
     * @returns - The {@link GenericDocument} of the document at the given {@link values.GenericId}, or `null` if it no longer exists.
     */
    get(id: GenericId<TableName>): Promise<DocumentByName<DataModel, TableName> | null>;
    /**
     * Begin a query for the table.
     *
     * Queries don't execute immediately, so calling this method and extending its
     * query are free until the results are actually used.
     *
     * @returns - A {@link QueryInitializer} object to start building a query.
     */
    query(): QueryInitializer<NamedTableInfo<DataModel, TableName>>;
}
/**
 * An interface to read from the database within Convex query functions.
 *
 * The two entry points are:
 *   - {@link GenericDatabaseReader.get}, which fetches a single document
 *     by its {@link values.GenericId}.
 *   - {@link GenericDatabaseReader.query}, which starts building a query.
 *
 * If you're using code generation, use the `DatabaseReader` type in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @public
 */
export interface GenericDatabaseReader<DataModel extends GenericDataModel> extends BaseDatabaseReader<DataModel> {
    /**
     * An interface to read from the system tables within Convex query functions
     *
     * The two entry points are:
     *   - {@link GenericDatabaseReader.get}, which fetches a single document
     *     by its {@link values.GenericId}.
     *   - {@link GenericDatabaseReader.query}, which starts building a query.
     *
     * @public
     */
    system: BaseDatabaseReader<SystemDataModel>;
}
export interface GenericDatabaseReaderWithTable<DataModel extends GenericDataModel> extends BaseDatabaseReaderWithTable<DataModel> {
    /**
     * An interface to read from the system tables within Convex query functions
     *
     * The two entry points are:
     *   - {@link GenericDatabaseReader.get}, which fetches a single document
     *     by its {@link values.GenericId}.
     *   - {@link GenericDatabaseReader.query}, which starts building a query.
     *
     * @public
     */
    system: BaseDatabaseReaderWithTable<SystemDataModel>;
}
/**
 * An interface to read from and write to the database within Convex mutation
 * functions.
 *
 * Convex guarantees that all writes within a single mutation are
 * executed atomically, so you never have to worry about partial writes leaving
 * your data in an inconsistent state. See [the Convex Guide](https://docs.convex.dev/understanding/convex-fundamentals/functions#atomicity-and-optimistic-concurrency-control)
 * for the guarantees Convex provides your functions.
 *
 *  If you're using code generation, use the `DatabaseReader` type in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @public
 */
export interface GenericDatabaseWriter<DataModel extends GenericDataModel> extends GenericDatabaseReader<DataModel> {
    /**
     * Insert a new document into a table.
     *
     * @param table - The name of the table to insert a new document into.
     * @param value - The {@link values.Value} to insert into the given table.
     * @returns - {@link values.GenericId} of the new document.
     */
    insert<TableName extends TableNamesInDataModel<DataModel>>(table: TableName, value: WithoutSystemFields<DocumentByName<DataModel, TableName>>): Promise<GenericId<TableName>>;
    /**
     * Patch an existing document, shallow merging it with the given partial
     * document.
     *
     * New fields are added. Existing fields are overwritten. Fields set to
     * `undefined` are removed.
     *
     * @param id - The {@link values.GenericId} of the document to patch.
     * @param value - The partial {@link GenericDocument} to merge into the specified document. If this new value
     * specifies system fields like `_id`, they must match the document's existing field values.
     */
    patch<TableName extends TableNamesInDataModel<DataModel>>(id: GenericId<TableName>, value: PatchValue<DocumentByName<DataModel, TableName>>): Promise<void>;
    /**
     * Replace the value of an existing document, overwriting its old value.
     *
     * @param id - The {@link values.GenericId} of the document to replace.
     * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
     * and the database will fill them in.
     */
    replace<TableName extends TableNamesInDataModel<DataModel>>(id: GenericId<TableName>, value: WithOptionalSystemFields<DocumentByName<DataModel, TableName>>): Promise<void>;
    /**
     * Delete an existing document.
     *
     * @param id - The {@link values.GenericId} of the document to remove.
     */
    delete(id: GenericId<TableNamesInDataModel<DataModel>>): Promise<void>;
}
/**
 * An interface to read from and write to the database within Convex mutation
 * functions.
 *
 * Convex guarantees that all writes within a single mutation are
 * executed atomically, so you never have to worry about partial writes leaving
 * your data in an inconsistent state. See [the Convex Guide](https://docs.convex.dev/understanding/convex-fundamentals/functions#atomicity-and-optimistic-concurrency-control)
 * for the guarantees Convex provides your functions.
 *
 *  If you're using code generation, use the `DatabaseReader` type in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @public
 */
export interface GenericDatabaseWriterWithTable<DataModel extends GenericDataModel> extends GenericDatabaseReaderWithTable<DataModel> {
    /**
     * Scope the database to a specific table.
     */
    table<TableName extends TableNamesInDataModel<DataModel>>(tableName: TableName): BaseTableWriter<DataModel, TableName>;
}
export interface BaseTableWriter<DataModel extends GenericDataModel, TableName extends TableNamesInDataModel<DataModel>> extends BaseTableReader<DataModel, TableName> {
    /**
     * Insert a new document into the table.
     *
     * @param value - The {@link values.Value} to insert into the given table.
     * @returns - {@link values.GenericId} of the new document.
     */
    insert(value: WithoutSystemFields<DocumentByName<DataModel, TableName>>): Promise<GenericId<TableName>>;
    /**
     * Patch an existing document, shallow merging it with the given partial
     * document.
     *
     * New fields are added. Existing fields are overwritten. Fields set to
     * `undefined` are removed.
     *
     * @param id - The {@link values.GenericId} of the document to patch.
     * @param value - The partial {@link GenericDocument} to merge into the specified document. If this new value
     * specifies system fields like `_id`, they must match the document's existing field values.
     */
    patch(id: GenericId<TableName>, value: PatchValue<DocumentByName<DataModel, TableName>>): Promise<void>;
    /**
     * Replace the value of an existing document, overwriting its old value.
     *
     * @param id - The {@link values.GenericId} of the document to replace.
     * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
     * and the database will fill them in.
     */
    replace(id: GenericId<TableName>, value: WithOptionalSystemFields<DocumentByName<DataModel, TableName>>): Promise<void>;
    /**
     * Delete an existing document.
     *
     * @param id - The {@link values.GenericId} of the document to remove.
     */
    delete(id: GenericId<TableName>): Promise<void>;
}
/**
 * This is like Partial, but it also allows undefined to be passed to optional
 * fields when `exactOptionalPropertyTypes` is enabled in the tsconfig.
 */
type PatchValue<T> = {
    [P in keyof T]?: undefined extends T[P] ? T[P] | undefined : T[P];
};
export {};
//# sourceMappingURL=database.d.ts.map