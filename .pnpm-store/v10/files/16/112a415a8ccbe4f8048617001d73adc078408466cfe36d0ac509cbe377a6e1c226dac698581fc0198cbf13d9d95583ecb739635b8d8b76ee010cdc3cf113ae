import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { OnModifyForeignAction } from '../operation-node/references-node.js';
import { ColumnDefinitionNode } from '../operation-node/column-definition-node.js';
import { DefaultValueExpression } from '../parser/default-value-parser.js';
import { Expression } from '../expression/expression.js';
export declare class ColumnDefinitionBuilder implements OperationNodeSource {
    #private;
    constructor(node: ColumnDefinitionNode);
    /**
     * Adds `auto_increment` or `autoincrement` to the column definition
     * depending on the dialect.
     *
     * Some dialects like PostgreSQL don't support this. On PostgreSQL
     * you can use the `serial` or `bigserial` data type instead.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('person')
     *   .addColumn('id', 'integer', col => col.autoIncrement().primaryKey())
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `person` (
     *   `id` integer primary key auto_increment
     * )
     * ```
     */
    autoIncrement(): ColumnDefinitionBuilder;
    /**
     * Makes the column an identity column.
     *
     * This only works on some dialects like MS SQL Server (MSSQL).
     *
     * For PostgreSQL's `generated always as identity` use {@link generatedAlwaysAsIdentity}.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('person')
     *   .addColumn('id', 'integer', col => col.identity().primaryKey())
     *   .execute()
     * ```
     *
     * The generated SQL (MSSQL):
     *
     * ```sql
     * create table "person" (
     *   "id" integer identity primary key
     * )
     * ```
     */
    identity(): ColumnDefinitionBuilder;
    /**
     * Makes the column the primary key.
     *
     * If you want to specify a composite primary key use the
     * {@link CreateTableBuilder.addPrimaryKeyConstraint} method.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('person')
     *   .addColumn('id', 'integer', col => col.primaryKey())
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `person` (
     *   `id` integer primary key
     * )
     */
    primaryKey(): ColumnDefinitionBuilder;
    /**
     * Adds a foreign key constraint for the column.
     *
     * If your database engine doesn't support foreign key constraints in the
     * column definition (like MySQL 5) you need to call the table level
     * {@link CreateTableBuilder.addForeignKeyConstraint} method instead.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('pet')
     *   .addColumn('owner_id', 'integer', (col) => col.references('person.id'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create table "pet" (
     *   "owner_id" integer references "person" ("id")
     * )
     * ```
     */
    references(ref: string): ColumnDefinitionBuilder;
    /**
     * Adds an `on delete` constraint for the foreign key column.
     *
     * If your database engine doesn't support foreign key constraints in the
     * column definition (like MySQL 5) you need to call the table level
     * {@link CreateTableBuilder.addForeignKeyConstraint} method instead.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('pet')
     *   .addColumn(
     *     'owner_id',
     *     'integer',
     *     (col) => col.references('person.id').onDelete('cascade')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create table "pet" (
     *   "owner_id" integer references "person" ("id") on delete cascade
     * )
     * ```
     */
    onDelete(onDelete: OnModifyForeignAction): ColumnDefinitionBuilder;
    /**
     * Adds an `on update` constraint for the foreign key column.
     *
     * If your database engine doesn't support foreign key constraints in the
     * column definition (like MySQL 5) you need to call the table level
     * {@link CreateTableBuilder.addForeignKeyConstraint} method instead.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('pet')
     *   .addColumn(
     *     'owner_id',
     *     'integer',
     *     (col) => col.references('person.id').onUpdate('cascade')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create table "pet" (
     *   "owner_id" integer references "person" ("id") on update cascade
     * )
     * ```
     */
    onUpdate(onUpdate: OnModifyForeignAction): ColumnDefinitionBuilder;
    /**
     * Adds a unique constraint for the column.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('person')
     *   .addColumn('email', 'varchar(255)', col => col.unique())
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `person` (
     *   `email` varchar(255) unique
     * )
     * ```
     */
    unique(): ColumnDefinitionBuilder;
    /**
     * Adds a `not null` constraint for the column.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('person')
     *   .addColumn('first_name', 'varchar(255)', col => col.notNull())
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `person` (
     *   `first_name` varchar(255) not null
     * )
     * ```
     */
    notNull(): ColumnDefinitionBuilder;
    /**
     * Adds a `unsigned` modifier for the column.
     *
     * This only works on some dialects like MySQL.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('person')
     *   .addColumn('age', 'integer', col => col.unsigned())
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `person` (
     *   `age` integer unsigned
     * )
     * ```
     */
    unsigned(): ColumnDefinitionBuilder;
    /**
     * Adds a default value constraint for the column.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('pet')
     *   .addColumn('number_of_legs', 'integer', (col) => col.defaultTo(4))
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `pet` (
     *   `number_of_legs` integer default 4
     * )
     * ```
     *
     * Values passed to `defaultTo` are interpreted as value literals by default. You can define
     * an arbitrary SQL expression using the {@link sql} template tag:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.schema
     *   .createTable('pet')
     *   .addColumn(
     *     'created_at',
     *     'timestamp',
     *     (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`)
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `pet` (
     *   `created_at` timestamp default CURRENT_TIMESTAMP
     * )
     * ```
     */
    defaultTo(value: DefaultValueExpression): ColumnDefinitionBuilder;
    /**
     * Adds a check constraint for the column.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.schema
     *   .createTable('pet')
     *   .addColumn('number_of_legs', 'integer', (col) =>
     *     col.check(sql`number_of_legs < 5`)
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `pet` (
     *   `number_of_legs` integer check (number_of_legs < 5)
     * )
     * ```
     */
    check(expression: Expression<any>): ColumnDefinitionBuilder;
    /**
     * Makes the column a generated column using a `generated always as` statement.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.schema
     *   .createTable('person')
     *   .addColumn('full_name', 'varchar(255)',
     *     (col) => col.generatedAlwaysAs(sql`concat(first_name, ' ', last_name)`)
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `person` (
     *   `full_name` varchar(255) generated always as (concat(first_name, ' ', last_name))
     * )
     * ```
     */
    generatedAlwaysAs(expression: Expression<any>): ColumnDefinitionBuilder;
    /**
     * Adds the `generated always as identity` specifier.
     *
     * This only works on some dialects like PostgreSQL.
     *
     * For MS SQL Server (MSSQL)'s identity column use {@link identity}.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('person')
     *   .addColumn('id', 'integer', col => col.generatedAlwaysAsIdentity().primaryKey())
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create table "person" (
     *   "id" integer generated always as identity primary key
     * )
     * ```
     */
    generatedAlwaysAsIdentity(): ColumnDefinitionBuilder;
    /**
     * Adds the `generated by default as identity` specifier on supported dialects.
     *
     * This only works on some dialects like PostgreSQL.
     *
     * For MS SQL Server (MSSQL)'s identity column use {@link identity}.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createTable('person')
     *   .addColumn('id', 'integer', col => col.generatedByDefaultAsIdentity().primaryKey())
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create table "person" (
     *   "id" integer generated by default as identity primary key
     * )
     * ```
     */
    generatedByDefaultAsIdentity(): ColumnDefinitionBuilder;
    /**
     * Makes a generated column stored instead of virtual. This method can only
     * be used with {@link generatedAlwaysAs}
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.schema
     *   .createTable('person')
     *   .addColumn('full_name', 'varchar(255)', (col) => col
     *     .generatedAlwaysAs(sql`concat(first_name, ' ', last_name)`)
     *     .stored()
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `person` (
     *   `full_name` varchar(255) generated always as (concat(first_name, ' ', last_name)) stored
     * )
     * ```
     */
    stored(): ColumnDefinitionBuilder;
    /**
     * This can be used to add any additional SQL right after the column's data type.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.schema
     *   .createTable('person')
     *   .addColumn('id', 'integer', col => col.primaryKey())
     *   .addColumn(
     *     'first_name',
     *     'varchar(36)',
     *     (col) => col.modifyFront(sql`collate utf8mb4_general_ci`).notNull()
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `person` (
     *   `id` integer primary key,
     *   `first_name` varchar(36) collate utf8mb4_general_ci not null
     * )
     * ```
     */
    modifyFront(modifier: Expression<any>): ColumnDefinitionBuilder;
    /**
     * Adds `nulls not distinct` specifier.
     * Should be used with `unique` constraint.
     *
     * This only works on some dialects like PostgreSQL.
     *
     * ### Examples
     *
     * ```ts
     * db.schema
     *   .createTable('person')
     *   .addColumn('id', 'integer', col => col.primaryKey())
     *   .addColumn('first_name', 'varchar(30)', col => col.unique().nullsNotDistinct())
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create table "person" (
     *   "id" integer primary key,
     *   "first_name" varchar(30) unique nulls not distinct
     * )
     * ```
     */
    nullsNotDistinct(): ColumnDefinitionBuilder;
    /**
     * Adds `if not exists` specifier. This only works for PostgreSQL.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .alterTable('person')
     *   .addColumn('email', 'varchar(255)', col => col.unique().ifNotExists())
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * alter table "person" add column if not exists "email" varchar(255) unique
     * ```
     */
    ifNotExists(): ColumnDefinitionBuilder;
    /**
     * This can be used to add any additional SQL to the end of the column definition.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.schema
     *   .createTable('person')
     *   .addColumn('id', 'integer', col => col.primaryKey())
     *   .addColumn(
     *     'age',
     *     'integer',
     *     col => col.unsigned()
     *       .notNull()
     *       .modifyEnd(sql`comment ${sql.lit('it is not polite to ask a woman her age')}`)
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * create table `person` (
     *   `id` integer primary key,
     *   `age` integer unsigned not null comment 'it is not polite to ask a woman her age'
     * )
     * ```
     */
    modifyEnd(modifier: Expression<any>): ColumnDefinitionBuilder;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): ColumnDefinitionNode;
}
export type ColumnDefinitionBuilderCallback = (builder: ColumnDefinitionBuilder) => ColumnDefinitionBuilder;
