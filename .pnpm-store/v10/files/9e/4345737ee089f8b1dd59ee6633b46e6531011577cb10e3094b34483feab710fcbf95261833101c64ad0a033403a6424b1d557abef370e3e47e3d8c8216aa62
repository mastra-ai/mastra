/// <reference types="./column-definition-builder.d.ts" />
import { CheckConstraintNode } from '../operation-node/check-constraint-node.js';
import { ReferencesNode, } from '../operation-node/references-node.js';
import { SelectAllNode } from '../operation-node/select-all-node.js';
import { parseStringReference } from '../parser/reference-parser.js';
import { ColumnDefinitionNode } from '../operation-node/column-definition-node.js';
import { parseDefaultValueExpression, } from '../parser/default-value-parser.js';
import { GeneratedNode } from '../operation-node/generated-node.js';
import { DefaultValueNode } from '../operation-node/default-value-node.js';
import { parseOnModifyForeignAction } from '../parser/on-modify-action-parser.js';
export class ColumnDefinitionBuilder {
    #node;
    constructor(node) {
        this.#node = node;
    }
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
    autoIncrement() {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, { autoIncrement: true }));
    }
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
    identity() {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, { identity: true }));
    }
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
    primaryKey() {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, { primaryKey: true }));
    }
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
    references(ref) {
        const references = parseStringReference(ref);
        if (!references.table || SelectAllNode.is(references.column)) {
            throw new Error(`invalid call references('${ref}'). The reference must have format table.column or schema.table.column`);
        }
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, {
            references: ReferencesNode.create(references.table, [
                references.column,
            ]),
        }));
    }
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
    onDelete(onDelete) {
        if (!this.#node.references) {
            throw new Error('on delete constraint can only be added for foreign keys');
        }
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, {
            references: ReferencesNode.cloneWithOnDelete(this.#node.references, parseOnModifyForeignAction(onDelete)),
        }));
    }
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
    onUpdate(onUpdate) {
        if (!this.#node.references) {
            throw new Error('on update constraint can only be added for foreign keys');
        }
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, {
            references: ReferencesNode.cloneWithOnUpdate(this.#node.references, parseOnModifyForeignAction(onUpdate)),
        }));
    }
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
    unique() {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, { unique: true }));
    }
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
    notNull() {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, { notNull: true }));
    }
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
    unsigned() {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, { unsigned: true }));
    }
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
    defaultTo(value) {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, {
            defaultTo: DefaultValueNode.create(parseDefaultValueExpression(value)),
        }));
    }
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
    check(expression) {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, {
            check: CheckConstraintNode.create(expression.toOperationNode()),
        }));
    }
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
    generatedAlwaysAs(expression) {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, {
            generated: GeneratedNode.createWithExpression(expression.toOperationNode()),
        }));
    }
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
    generatedAlwaysAsIdentity() {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, {
            generated: GeneratedNode.create({ identity: true, always: true }),
        }));
    }
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
    generatedByDefaultAsIdentity() {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, {
            generated: GeneratedNode.create({ identity: true, byDefault: true }),
        }));
    }
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
    stored() {
        if (!this.#node.generated) {
            throw new Error('stored() can only be called after generatedAlwaysAs');
        }
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, {
            generated: GeneratedNode.cloneWith(this.#node.generated, {
                stored: true,
            }),
        }));
    }
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
    modifyFront(modifier) {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWithFrontModifier(this.#node, modifier.toOperationNode()));
    }
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
    nullsNotDistinct() {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, { nullsNotDistinct: true }));
    }
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
    ifNotExists() {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWith(this.#node, { ifNotExists: true }));
    }
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
    modifyEnd(modifier) {
        return new ColumnDefinitionBuilder(ColumnDefinitionNode.cloneWithEndModifier(this.#node, modifier.toOperationNode()));
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
    toOperationNode() {
        return this.#node;
    }
}
