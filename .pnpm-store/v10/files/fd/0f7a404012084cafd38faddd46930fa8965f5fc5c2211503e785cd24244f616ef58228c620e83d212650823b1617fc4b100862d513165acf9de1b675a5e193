/// <reference types="./default-query-compiler.d.ts" />
import { CreateTableNode } from '../operation-node/create-table-node.js';
import { InsertQueryNode } from '../operation-node/insert-query-node.js';
import { OperationNodeVisitor } from '../operation-node/operation-node-visitor.js';
import { OperatorNode } from '../operation-node/operator-node.js';
import { ParensNode } from '../operation-node/parens-node.js';
import { RawNode } from '../operation-node/raw-node.js';
import { freeze, isString, isNumber, isBoolean, isNull, isDate, isBigInt, } from '../util/object-utils.js';
import { CreateViewNode } from '../operation-node/create-view-node.js';
import { SetOperationNode } from '../operation-node/set-operation-node.js';
import { WhenNode } from '../operation-node/when-node.js';
import { logOnce } from '../util/log-once.js';
const LIT_WRAP_REGEX = /'/g;
export class DefaultQueryCompiler extends OperationNodeVisitor {
    #sql = '';
    #parameters = [];
    get numParameters() {
        return this.#parameters.length;
    }
    compileQuery(node, queryId) {
        this.#sql = '';
        this.#parameters = [];
        this.nodeStack.splice(0, this.nodeStack.length);
        this.visitNode(node);
        return freeze({
            query: node,
            queryId,
            sql: this.getSql(),
            parameters: [...this.#parameters],
        });
    }
    getSql() {
        return this.#sql;
    }
    visitSelectQuery(node) {
        const wrapInParens = this.parentNode !== undefined &&
            !ParensNode.is(this.parentNode) &&
            !InsertQueryNode.is(this.parentNode) &&
            !CreateTableNode.is(this.parentNode) &&
            !CreateViewNode.is(this.parentNode) &&
            !SetOperationNode.is(this.parentNode);
        if (this.parentNode === undefined && node.explain) {
            this.visitNode(node.explain);
            this.append(' ');
        }
        if (wrapInParens) {
            this.append('(');
        }
        if (node.with) {
            this.visitNode(node.with);
            this.append(' ');
        }
        this.append('select');
        if (node.distinctOn) {
            this.append(' ');
            this.compileDistinctOn(node.distinctOn);
        }
        if (node.frontModifiers?.length) {
            this.append(' ');
            this.compileList(node.frontModifiers, ' ');
        }
        if (node.top) {
            this.append(' ');
            this.visitNode(node.top);
        }
        if (node.selections) {
            this.append(' ');
            this.compileList(node.selections);
        }
        if (node.from) {
            this.append(' ');
            this.visitNode(node.from);
        }
        if (node.joins) {
            this.append(' ');
            this.compileList(node.joins, ' ');
        }
        if (node.where) {
            this.append(' ');
            this.visitNode(node.where);
        }
        if (node.groupBy) {
            this.append(' ');
            this.visitNode(node.groupBy);
        }
        if (node.having) {
            this.append(' ');
            this.visitNode(node.having);
        }
        if (node.setOperations) {
            this.append(' ');
            this.compileList(node.setOperations, ' ');
        }
        if (node.orderBy) {
            this.append(' ');
            this.visitNode(node.orderBy);
        }
        if (node.limit) {
            this.append(' ');
            this.visitNode(node.limit);
        }
        if (node.offset) {
            this.append(' ');
            this.visitNode(node.offset);
        }
        if (node.fetch) {
            this.append(' ');
            this.visitNode(node.fetch);
        }
        if (node.endModifiers?.length) {
            this.append(' ');
            this.compileList(this.sortSelectModifiers([...node.endModifiers]), ' ');
        }
        if (wrapInParens) {
            this.append(')');
        }
    }
    visitFrom(node) {
        this.append('from ');
        this.compileList(node.froms);
    }
    visitSelection(node) {
        this.visitNode(node.selection);
    }
    visitColumn(node) {
        this.visitNode(node.column);
    }
    compileDistinctOn(expressions) {
        this.append('distinct on (');
        this.compileList(expressions);
        this.append(')');
    }
    compileList(nodes, separator = ', ') {
        const lastIndex = nodes.length - 1;
        for (let i = 0; i <= lastIndex; i++) {
            this.visitNode(nodes[i]);
            if (i < lastIndex) {
                this.append(separator);
            }
        }
    }
    visitWhere(node) {
        this.append('where ');
        this.visitNode(node.where);
    }
    visitHaving(node) {
        this.append('having ');
        this.visitNode(node.having);
    }
    visitInsertQuery(node) {
        const wrapInParens = this.parentNode !== undefined &&
            !ParensNode.is(this.parentNode) &&
            !RawNode.is(this.parentNode) &&
            !WhenNode.is(this.parentNode);
        if (this.parentNode === undefined && node.explain) {
            this.visitNode(node.explain);
            this.append(' ');
        }
        if (wrapInParens) {
            this.append('(');
        }
        if (node.with) {
            this.visitNode(node.with);
            this.append(' ');
        }
        this.append(node.replace ? 'replace' : 'insert');
        // TODO: remove in 0.29.
        if (node.ignore) {
            logOnce('`InsertQueryNode.ignore` is deprecated. Use `InsertQueryNode.orAction` instead.');
            this.append(' ignore');
        }
        if (node.orAction) {
            this.append(' ');
            this.visitNode(node.orAction);
        }
        if (node.top) {
            this.append(' ');
            this.visitNode(node.top);
        }
        if (node.into) {
            this.append(' into ');
            this.visitNode(node.into);
        }
        if (node.columns) {
            this.append(' (');
            this.compileList(node.columns);
            this.append(')');
        }
        if (node.output) {
            this.append(' ');
            this.visitNode(node.output);
        }
        if (node.values) {
            this.append(' ');
            this.visitNode(node.values);
        }
        if (node.defaultValues) {
            this.append(' ');
            this.append('default values');
        }
        if (node.onConflict) {
            this.append(' ');
            this.visitNode(node.onConflict);
        }
        if (node.onDuplicateKey) {
            this.append(' ');
            this.visitNode(node.onDuplicateKey);
        }
        if (node.returning) {
            this.append(' ');
            this.visitNode(node.returning);
        }
        if (wrapInParens) {
            this.append(')');
        }
        if (node.endModifiers?.length) {
            this.append(' ');
            this.compileList(node.endModifiers, ' ');
        }
    }
    visitValues(node) {
        this.append('values ');
        this.compileList(node.values);
    }
    visitDeleteQuery(node) {
        const wrapInParens = this.parentNode !== undefined &&
            !ParensNode.is(this.parentNode) &&
            !RawNode.is(this.parentNode);
        if (this.parentNode === undefined && node.explain) {
            this.visitNode(node.explain);
            this.append(' ');
        }
        if (wrapInParens) {
            this.append('(');
        }
        if (node.with) {
            this.visitNode(node.with);
            this.append(' ');
        }
        this.append('delete ');
        if (node.top) {
            this.visitNode(node.top);
            this.append(' ');
        }
        this.visitNode(node.from);
        if (node.output) {
            this.append(' ');
            this.visitNode(node.output);
        }
        if (node.using) {
            this.append(' ');
            this.visitNode(node.using);
        }
        if (node.joins) {
            this.append(' ');
            this.compileList(node.joins, ' ');
        }
        if (node.where) {
            this.append(' ');
            this.visitNode(node.where);
        }
        if (node.orderBy) {
            this.append(' ');
            this.visitNode(node.orderBy);
        }
        if (node.limit) {
            this.append(' ');
            this.visitNode(node.limit);
        }
        if (node.returning) {
            this.append(' ');
            this.visitNode(node.returning);
        }
        if (wrapInParens) {
            this.append(')');
        }
        if (node.endModifiers?.length) {
            this.append(' ');
            this.compileList(node.endModifiers, ' ');
        }
    }
    visitReturning(node) {
        this.append('returning ');
        this.compileList(node.selections);
    }
    visitAlias(node) {
        this.visitNode(node.node);
        this.append(' as ');
        this.visitNode(node.alias);
    }
    visitReference(node) {
        if (node.table) {
            this.visitNode(node.table);
            this.append('.');
        }
        this.visitNode(node.column);
    }
    visitSelectAll(_) {
        this.append('*');
    }
    visitIdentifier(node) {
        this.append(this.getLeftIdentifierWrapper());
        this.compileUnwrappedIdentifier(node);
        this.append(this.getRightIdentifierWrapper());
    }
    compileUnwrappedIdentifier(node) {
        if (!isString(node.name)) {
            throw new Error('a non-string identifier was passed to compileUnwrappedIdentifier.');
        }
        this.append(this.sanitizeIdentifier(node.name));
    }
    visitAnd(node) {
        this.visitNode(node.left);
        this.append(' and ');
        this.visitNode(node.right);
    }
    visitOr(node) {
        this.visitNode(node.left);
        this.append(' or ');
        this.visitNode(node.right);
    }
    visitValue(node) {
        if (node.immediate) {
            this.appendImmediateValue(node.value);
        }
        else {
            this.appendValue(node.value);
        }
    }
    visitValueList(node) {
        this.append('(');
        this.compileList(node.values);
        this.append(')');
    }
    visitTuple(node) {
        this.append('(');
        this.compileList(node.values);
        this.append(')');
    }
    visitPrimitiveValueList(node) {
        this.append('(');
        const { values } = node;
        for (let i = 0; i < values.length; ++i) {
            this.appendValue(values[i]);
            if (i !== values.length - 1) {
                this.append(', ');
            }
        }
        this.append(')');
    }
    visitParens(node) {
        this.append('(');
        this.visitNode(node.node);
        this.append(')');
    }
    visitJoin(node) {
        this.append(JOIN_TYPE_SQL[node.joinType]);
        this.append(' ');
        this.visitNode(node.table);
        if (node.on) {
            this.append(' ');
            this.visitNode(node.on);
        }
    }
    visitOn(node) {
        this.append('on ');
        this.visitNode(node.on);
    }
    visitRaw(node) {
        const { sqlFragments, parameters: params } = node;
        for (let i = 0; i < sqlFragments.length; ++i) {
            this.append(sqlFragments[i]);
            if (params.length > i) {
                this.visitNode(params[i]);
            }
        }
    }
    visitOperator(node) {
        this.append(node.operator);
    }
    visitTable(node) {
        this.visitNode(node.table);
    }
    visitSchemableIdentifier(node) {
        if (node.schema) {
            this.visitNode(node.schema);
            this.append('.');
        }
        this.visitNode(node.identifier);
    }
    visitCreateTable(node) {
        this.append('create ');
        if (node.frontModifiers && node.frontModifiers.length > 0) {
            this.compileList(node.frontModifiers, ' ');
            this.append(' ');
        }
        if (node.temporary) {
            this.append('temporary ');
        }
        this.append('table ');
        if (node.ifNotExists) {
            this.append('if not exists ');
        }
        this.visitNode(node.table);
        if (node.selectQuery) {
            this.append(' as ');
            this.visitNode(node.selectQuery);
        }
        else {
            this.append(' (');
            this.compileList([...node.columns, ...(node.constraints ?? [])]);
            this.append(')');
            if (node.onCommit) {
                this.append(' on commit ');
                this.append(node.onCommit);
            }
            if (node.endModifiers && node.endModifiers.length > 0) {
                this.append(' ');
                this.compileList(node.endModifiers, ' ');
            }
        }
    }
    visitColumnDefinition(node) {
        if (node.ifNotExists) {
            this.append('if not exists ');
        }
        this.visitNode(node.column);
        this.append(' ');
        this.visitNode(node.dataType);
        if (node.unsigned) {
            this.append(' unsigned');
        }
        if (node.frontModifiers && node.frontModifiers.length > 0) {
            this.append(' ');
            this.compileList(node.frontModifiers, ' ');
        }
        if (node.generated) {
            this.append(' ');
            this.visitNode(node.generated);
        }
        if (node.identity) {
            this.append(' identity');
        }
        if (node.defaultTo) {
            this.append(' ');
            this.visitNode(node.defaultTo);
        }
        if (node.notNull) {
            this.append(' not null');
        }
        if (node.unique) {
            this.append(' unique');
        }
        if (node.nullsNotDistinct) {
            this.append(' nulls not distinct');
        }
        if (node.primaryKey) {
            this.append(' primary key');
        }
        if (node.autoIncrement) {
            this.append(' ');
            this.append(this.getAutoIncrement());
        }
        if (node.references) {
            this.append(' ');
            this.visitNode(node.references);
        }
        if (node.check) {
            this.append(' ');
            this.visitNode(node.check);
        }
        if (node.endModifiers && node.endModifiers.length > 0) {
            this.append(' ');
            this.compileList(node.endModifiers, ' ');
        }
    }
    getAutoIncrement() {
        return 'auto_increment';
    }
    visitReferences(node) {
        this.append('references ');
        this.visitNode(node.table);
        this.append(' (');
        this.compileList(node.columns);
        this.append(')');
        if (node.onDelete) {
            this.append(' on delete ');
            this.append(node.onDelete);
        }
        if (node.onUpdate) {
            this.append(' on update ');
            this.append(node.onUpdate);
        }
    }
    visitDropTable(node) {
        this.append('drop table ');
        if (node.ifExists) {
            this.append('if exists ');
        }
        this.visitNode(node.table);
        if (node.cascade) {
            this.append(' cascade');
        }
    }
    visitDataType(node) {
        this.append(node.dataType);
    }
    visitOrderBy(node) {
        this.append('order by ');
        this.compileList(node.items);
    }
    visitOrderByItem(node) {
        this.visitNode(node.orderBy);
        if (node.collation) {
            this.append(' ');
            this.visitNode(node.collation);
        }
        if (node.direction) {
            this.append(' ');
            this.visitNode(node.direction);
        }
        if (node.nulls) {
            this.append(' nulls ');
            this.append(node.nulls);
        }
    }
    visitGroupBy(node) {
        this.append('group by ');
        this.compileList(node.items);
    }
    visitGroupByItem(node) {
        this.visitNode(node.groupBy);
    }
    visitUpdateQuery(node) {
        const wrapInParens = this.parentNode !== undefined &&
            !ParensNode.is(this.parentNode) &&
            !RawNode.is(this.parentNode) &&
            !WhenNode.is(this.parentNode);
        if (this.parentNode === undefined && node.explain) {
            this.visitNode(node.explain);
            this.append(' ');
        }
        if (wrapInParens) {
            this.append('(');
        }
        if (node.with) {
            this.visitNode(node.with);
            this.append(' ');
        }
        this.append('update ');
        if (node.top) {
            this.visitNode(node.top);
            this.append(' ');
        }
        if (node.table) {
            this.visitNode(node.table);
            this.append(' ');
        }
        this.append('set ');
        if (node.updates) {
            this.compileList(node.updates);
        }
        if (node.output) {
            this.append(' ');
            this.visitNode(node.output);
        }
        if (node.from) {
            this.append(' ');
            this.visitNode(node.from);
        }
        if (node.joins) {
            if (!node.from) {
                throw new Error("Joins in an update query are only supported as a part of a PostgreSQL 'update set from join' query. If you want to create a MySQL 'update join set' query, see https://kysely.dev/docs/examples/update/my-sql-joins");
            }
            this.append(' ');
            this.compileList(node.joins, ' ');
        }
        if (node.where) {
            this.append(' ');
            this.visitNode(node.where);
        }
        if (node.orderBy) {
            this.append(' ');
            this.visitNode(node.orderBy);
        }
        if (node.limit) {
            this.append(' ');
            this.visitNode(node.limit);
        }
        if (node.returning) {
            this.append(' ');
            this.visitNode(node.returning);
        }
        if (wrapInParens) {
            this.append(')');
        }
        if (node.endModifiers?.length) {
            this.append(' ');
            this.compileList(node.endModifiers, ' ');
        }
    }
    visitColumnUpdate(node) {
        this.visitNode(node.column);
        this.append(' = ');
        this.visitNode(node.value);
    }
    visitLimit(node) {
        this.append('limit ');
        this.visitNode(node.limit);
    }
    visitOffset(node) {
        this.append('offset ');
        this.visitNode(node.offset);
    }
    visitOnConflict(node) {
        this.append('on conflict');
        if (node.columns) {
            this.append(' (');
            this.compileList(node.columns);
            this.append(')');
        }
        else if (node.constraint) {
            this.append(' on constraint ');
            this.visitNode(node.constraint);
        }
        else if (node.indexExpression) {
            this.append(' (');
            this.visitNode(node.indexExpression);
            this.append(')');
        }
        if (node.indexWhere) {
            this.append(' ');
            this.visitNode(node.indexWhere);
        }
        if (node.doNothing === true) {
            this.append(' do nothing');
        }
        else if (node.updates) {
            this.append(' do update set ');
            this.compileList(node.updates);
            if (node.updateWhere) {
                this.append(' ');
                this.visitNode(node.updateWhere);
            }
        }
    }
    visitOnDuplicateKey(node) {
        this.append('on duplicate key update ');
        this.compileList(node.updates);
    }
    visitCreateIndex(node) {
        this.append('create ');
        if (node.unique) {
            this.append('unique ');
        }
        this.append('index ');
        if (node.ifNotExists) {
            this.append('if not exists ');
        }
        this.visitNode(node.name);
        if (node.table) {
            this.append(' on ');
            this.visitNode(node.table);
        }
        if (node.using) {
            this.append(' using ');
            this.visitNode(node.using);
        }
        if (node.columns) {
            this.append(' (');
            this.compileList(node.columns);
            this.append(')');
        }
        if (node.nullsNotDistinct) {
            this.append(' nulls not distinct');
        }
        if (node.where) {
            this.append(' ');
            this.visitNode(node.where);
        }
    }
    visitDropIndex(node) {
        this.append('drop index ');
        if (node.ifExists) {
            this.append('if exists ');
        }
        this.visitNode(node.name);
        if (node.table) {
            this.append(' on ');
            this.visitNode(node.table);
        }
        if (node.cascade) {
            this.append(' cascade');
        }
    }
    visitCreateSchema(node) {
        this.append('create schema ');
        if (node.ifNotExists) {
            this.append('if not exists ');
        }
        this.visitNode(node.schema);
    }
    visitDropSchema(node) {
        this.append('drop schema ');
        if (node.ifExists) {
            this.append('if exists ');
        }
        this.visitNode(node.schema);
        if (node.cascade) {
            this.append(' cascade');
        }
    }
    visitPrimaryKeyConstraint(node) {
        if (node.name) {
            this.append('constraint ');
            this.visitNode(node.name);
            this.append(' ');
        }
        this.append('primary key (');
        this.compileList(node.columns);
        this.append(')');
        this.buildDeferrable(node);
    }
    buildDeferrable(node) {
        if (node.deferrable !== undefined) {
            if (node.deferrable) {
                this.append(' deferrable');
            }
            else {
                this.append(' not deferrable');
            }
        }
        if (node.initiallyDeferred !== undefined) {
            if (node.initiallyDeferred) {
                this.append(' initially deferred');
            }
            else {
                this.append(' initially immediate');
            }
        }
    }
    visitUniqueConstraint(node) {
        if (node.name) {
            this.append('constraint ');
            this.visitNode(node.name);
            this.append(' ');
        }
        this.append('unique');
        if (node.nullsNotDistinct) {
            this.append(' nulls not distinct');
        }
        this.append(' (');
        this.compileList(node.columns);
        this.append(')');
        this.buildDeferrable(node);
    }
    visitCheckConstraint(node) {
        if (node.name) {
            this.append('constraint ');
            this.visitNode(node.name);
            this.append(' ');
        }
        this.append('check (');
        this.visitNode(node.expression);
        this.append(')');
    }
    visitForeignKeyConstraint(node) {
        if (node.name) {
            this.append('constraint ');
            this.visitNode(node.name);
            this.append(' ');
        }
        this.append('foreign key (');
        this.compileList(node.columns);
        this.append(') ');
        this.visitNode(node.references);
        if (node.onDelete) {
            this.append(' on delete ');
            this.append(node.onDelete);
        }
        if (node.onUpdate) {
            this.append(' on update ');
            this.append(node.onUpdate);
        }
        this.buildDeferrable(node);
    }
    visitList(node) {
        this.compileList(node.items);
    }
    visitWith(node) {
        this.append('with ');
        if (node.recursive) {
            this.append('recursive ');
        }
        this.compileList(node.expressions);
    }
    visitCommonTableExpression(node) {
        this.visitNode(node.name);
        this.append(' as ');
        if (isBoolean(node.materialized)) {
            if (!node.materialized) {
                this.append('not ');
            }
            this.append('materialized ');
        }
        this.visitNode(node.expression);
    }
    visitCommonTableExpressionName(node) {
        this.visitNode(node.table);
        if (node.columns) {
            this.append('(');
            this.compileList(node.columns);
            this.append(')');
        }
    }
    visitAlterTable(node) {
        this.append('alter table ');
        this.visitNode(node.table);
        this.append(' ');
        if (node.renameTo) {
            this.append('rename to ');
            this.visitNode(node.renameTo);
        }
        if (node.setSchema) {
            this.append('set schema ');
            this.visitNode(node.setSchema);
        }
        if (node.addConstraint) {
            this.visitNode(node.addConstraint);
        }
        if (node.dropConstraint) {
            this.visitNode(node.dropConstraint);
        }
        if (node.renameConstraint) {
            this.visitNode(node.renameConstraint);
        }
        if (node.columnAlterations) {
            this.compileColumnAlterations(node.columnAlterations);
        }
        if (node.addIndex) {
            this.visitNode(node.addIndex);
        }
        if (node.dropIndex) {
            this.visitNode(node.dropIndex);
        }
    }
    visitAddColumn(node) {
        this.append('add column ');
        this.visitNode(node.column);
    }
    visitRenameColumn(node) {
        this.append('rename column ');
        this.visitNode(node.column);
        this.append(' to ');
        this.visitNode(node.renameTo);
    }
    visitDropColumn(node) {
        this.append('drop column ');
        this.visitNode(node.column);
    }
    visitAlterColumn(node) {
        this.append('alter column ');
        this.visitNode(node.column);
        this.append(' ');
        if (node.dataType) {
            if (this.announcesNewColumnDataType()) {
                this.append('type ');
            }
            this.visitNode(node.dataType);
            if (node.dataTypeExpression) {
                this.append('using ');
                this.visitNode(node.dataTypeExpression);
            }
        }
        if (node.setDefault) {
            this.append('set default ');
            this.visitNode(node.setDefault);
        }
        if (node.dropDefault) {
            this.append('drop default');
        }
        if (node.setNotNull) {
            this.append('set not null');
        }
        if (node.dropNotNull) {
            this.append('drop not null');
        }
    }
    visitModifyColumn(node) {
        this.append('modify column ');
        this.visitNode(node.column);
    }
    visitAddConstraint(node) {
        this.append('add ');
        this.visitNode(node.constraint);
    }
    visitDropConstraint(node) {
        this.append('drop constraint ');
        if (node.ifExists) {
            this.append('if exists ');
        }
        this.visitNode(node.constraintName);
        if (node.modifier === 'cascade') {
            this.append(' cascade');
        }
        else if (node.modifier === 'restrict') {
            this.append(' restrict');
        }
    }
    visitRenameConstraint(node) {
        this.append('rename constraint ');
        this.visitNode(node.oldName);
        this.append(' to ');
        this.visitNode(node.newName);
    }
    visitSetOperation(node) {
        this.append(node.operator);
        this.append(' ');
        if (node.all) {
            this.append('all ');
        }
        this.visitNode(node.expression);
    }
    visitCreateView(node) {
        this.append('create ');
        if (node.orReplace) {
            this.append('or replace ');
        }
        if (node.materialized) {
            this.append('materialized ');
        }
        if (node.temporary) {
            this.append('temporary ');
        }
        this.append('view ');
        if (node.ifNotExists) {
            this.append('if not exists ');
        }
        this.visitNode(node.name);
        this.append(' ');
        if (node.columns) {
            this.append('(');
            this.compileList(node.columns);
            this.append(') ');
        }
        if (node.as) {
            this.append('as ');
            this.visitNode(node.as);
        }
    }
    visitRefreshMaterializedView(node) {
        this.append('refresh materialized view ');
        if (node.concurrently) {
            this.append('concurrently ');
        }
        this.visitNode(node.name);
        if (node.withNoData) {
            this.append(' with no data');
        }
        else {
            this.append(' with data');
        }
    }
    visitDropView(node) {
        this.append('drop ');
        if (node.materialized) {
            this.append('materialized ');
        }
        this.append('view ');
        if (node.ifExists) {
            this.append('if exists ');
        }
        this.visitNode(node.name);
        if (node.cascade) {
            this.append(' cascade');
        }
    }
    visitGenerated(node) {
        this.append('generated ');
        if (node.always) {
            this.append('always ');
        }
        if (node.byDefault) {
            this.append('by default ');
        }
        this.append('as ');
        if (node.identity) {
            this.append('identity');
        }
        if (node.expression) {
            this.append('(');
            this.visitNode(node.expression);
            this.append(')');
        }
        if (node.stored) {
            this.append(' stored');
        }
    }
    visitDefaultValue(node) {
        this.append('default ');
        this.visitNode(node.defaultValue);
    }
    visitSelectModifier(node) {
        if (node.rawModifier) {
            this.visitNode(node.rawModifier);
        }
        else {
            this.append(SELECT_MODIFIER_SQL[node.modifier]);
        }
        if (node.of) {
            this.append(' of ');
            this.compileList(node.of, ', ');
        }
    }
    visitCreateType(node) {
        this.append('create type ');
        this.visitNode(node.name);
        if (node.enum) {
            this.append(' as enum ');
            this.visitNode(node.enum);
        }
    }
    visitDropType(node) {
        this.append('drop type ');
        if (node.ifExists) {
            this.append('if exists ');
        }
        this.visitNode(node.name);
    }
    visitExplain(node) {
        this.append('explain');
        if (node.options || node.format) {
            this.append(' ');
            this.append(this.getLeftExplainOptionsWrapper());
            if (node.options) {
                this.visitNode(node.options);
                if (node.format) {
                    this.append(this.getExplainOptionsDelimiter());
                }
            }
            if (node.format) {
                this.append('format');
                this.append(this.getExplainOptionAssignment());
                this.append(node.format);
            }
            this.append(this.getRightExplainOptionsWrapper());
        }
    }
    visitDefaultInsertValue(_) {
        this.append('default');
    }
    visitAggregateFunction(node) {
        this.append(node.func);
        this.append('(');
        if (node.distinct) {
            this.append('distinct ');
        }
        this.compileList(node.aggregated);
        if (node.orderBy) {
            this.append(' ');
            this.visitNode(node.orderBy);
        }
        this.append(')');
        if (node.withinGroup) {
            this.append(' within group (');
            this.visitNode(node.withinGroup);
            this.append(')');
        }
        if (node.filter) {
            this.append(' filter(');
            this.visitNode(node.filter);
            this.append(')');
        }
        if (node.over) {
            this.append(' ');
            this.visitNode(node.over);
        }
    }
    visitOver(node) {
        this.append('over(');
        if (node.partitionBy) {
            this.visitNode(node.partitionBy);
            if (node.orderBy) {
                this.append(' ');
            }
        }
        if (node.orderBy) {
            this.visitNode(node.orderBy);
        }
        this.append(')');
    }
    visitPartitionBy(node) {
        this.append('partition by ');
        this.compileList(node.items);
    }
    visitPartitionByItem(node) {
        this.visitNode(node.partitionBy);
    }
    visitBinaryOperation(node) {
        this.visitNode(node.leftOperand);
        this.append(' ');
        this.visitNode(node.operator);
        this.append(' ');
        this.visitNode(node.rightOperand);
    }
    visitUnaryOperation(node) {
        this.visitNode(node.operator);
        if (!this.isMinusOperator(node.operator)) {
            this.append(' ');
        }
        this.visitNode(node.operand);
    }
    isMinusOperator(node) {
        return OperatorNode.is(node) && node.operator === '-';
    }
    visitUsing(node) {
        this.append('using ');
        this.compileList(node.tables);
    }
    visitFunction(node) {
        this.append(node.func);
        this.append('(');
        this.compileList(node.arguments);
        this.append(')');
    }
    visitCase(node) {
        this.append('case');
        if (node.value) {
            this.append(' ');
            this.visitNode(node.value);
        }
        if (node.when) {
            this.append(' ');
            this.compileList(node.when, ' ');
        }
        if (node.else) {
            this.append(' else ');
            this.visitNode(node.else);
        }
        this.append(' end');
        if (node.isStatement) {
            this.append(' case');
        }
    }
    visitWhen(node) {
        this.append('when ');
        this.visitNode(node.condition);
        if (node.result) {
            this.append(' then ');
            this.visitNode(node.result);
        }
    }
    visitJSONReference(node) {
        this.visitNode(node.reference);
        this.visitNode(node.traversal);
    }
    visitJSONPath(node) {
        if (node.inOperator) {
            this.visitNode(node.inOperator);
        }
        this.append("'$");
        for (const pathLeg of node.pathLegs) {
            this.visitNode(pathLeg);
        }
        this.append("'");
    }
    visitJSONPathLeg(node) {
        const isArrayLocation = node.type === 'ArrayLocation';
        this.append(isArrayLocation ? '[' : '.');
        this.append(String(node.value));
        if (isArrayLocation) {
            this.append(']');
        }
    }
    visitJSONOperatorChain(node) {
        for (let i = 0, len = node.values.length; i < len; i++) {
            if (i === len - 1) {
                this.visitNode(node.operator);
            }
            else {
                this.append('->');
            }
            this.visitNode(node.values[i]);
        }
    }
    visitMergeQuery(node) {
        if (node.with) {
            this.visitNode(node.with);
            this.append(' ');
        }
        this.append('merge ');
        if (node.top) {
            this.visitNode(node.top);
            this.append(' ');
        }
        this.append('into ');
        this.visitNode(node.into);
        if (node.using) {
            this.append(' ');
            this.visitNode(node.using);
        }
        if (node.whens) {
            this.append(' ');
            this.compileList(node.whens, ' ');
        }
        if (node.returning) {
            this.append(' ');
            this.visitNode(node.returning);
        }
        if (node.output) {
            this.append(' ');
            this.visitNode(node.output);
        }
        if (node.endModifiers?.length) {
            this.append(' ');
            this.compileList(node.endModifiers, ' ');
        }
    }
    visitMatched(node) {
        if (node.not) {
            this.append('not ');
        }
        this.append('matched');
        if (node.bySource) {
            this.append(' by source');
        }
    }
    visitAddIndex(node) {
        this.append('add ');
        if (node.unique) {
            this.append('unique ');
        }
        this.append('index ');
        this.visitNode(node.name);
        if (node.columns) {
            this.append(' (');
            this.compileList(node.columns);
            this.append(')');
        }
        if (node.using) {
            this.append(' using ');
            this.visitNode(node.using);
        }
    }
    visitCast(node) {
        this.append('cast(');
        this.visitNode(node.expression);
        this.append(' as ');
        this.visitNode(node.dataType);
        this.append(')');
    }
    visitFetch(node) {
        this.append('fetch next ');
        this.visitNode(node.rowCount);
        this.append(` rows ${node.modifier}`);
    }
    visitOutput(node) {
        this.append('output ');
        this.compileList(node.selections);
    }
    visitTop(node) {
        this.append(`top(${node.expression})`);
        if (node.modifiers) {
            this.append(` ${node.modifiers}`);
        }
    }
    visitOrAction(node) {
        this.append(node.action);
    }
    visitCollate(node) {
        this.append('collate ');
        this.visitNode(node.collation);
    }
    append(str) {
        this.#sql += str;
    }
    appendValue(parameter) {
        this.addParameter(parameter);
        this.append(this.getCurrentParameterPlaceholder());
    }
    getLeftIdentifierWrapper() {
        return '"';
    }
    getRightIdentifierWrapper() {
        return '"';
    }
    getCurrentParameterPlaceholder() {
        return '$' + this.numParameters;
    }
    getLeftExplainOptionsWrapper() {
        return '(';
    }
    getExplainOptionAssignment() {
        return ' ';
    }
    getExplainOptionsDelimiter() {
        return ', ';
    }
    getRightExplainOptionsWrapper() {
        return ')';
    }
    sanitizeIdentifier(identifier) {
        const leftWrap = this.getLeftIdentifierWrapper();
        const rightWrap = this.getRightIdentifierWrapper();
        let sanitized = '';
        for (const c of identifier) {
            sanitized += c;
            if (c === leftWrap) {
                sanitized += leftWrap;
            }
            else if (c === rightWrap) {
                sanitized += rightWrap;
            }
        }
        return sanitized;
    }
    sanitizeStringLiteral(value) {
        return value.replace(LIT_WRAP_REGEX, "''");
    }
    addParameter(parameter) {
        this.#parameters.push(parameter);
    }
    appendImmediateValue(value) {
        if (isString(value)) {
            this.appendStringLiteral(value);
        }
        else if (isNumber(value) || isBoolean(value) || isBigInt(value)) {
            this.append(value.toString());
        }
        else if (isNull(value)) {
            this.append('null');
        }
        else if (isDate(value)) {
            this.appendImmediateValue(value.toISOString());
        }
        else {
            throw new Error(`invalid immediate value ${value}`);
        }
    }
    appendStringLiteral(value) {
        this.append("'");
        this.append(this.sanitizeStringLiteral(value));
        this.append("'");
    }
    sortSelectModifiers(arr) {
        arr.sort((left, right) => left.modifier && right.modifier
            ? SELECT_MODIFIER_PRIORITY[left.modifier] -
                SELECT_MODIFIER_PRIORITY[right.modifier]
            : 1);
        return freeze(arr);
    }
    compileColumnAlterations(columnAlterations) {
        this.compileList(columnAlterations);
    }
    /**
     * controls whether the dialect adds a "type" keyword before a column's new data
     * type in an ALTER TABLE statement.
     */
    announcesNewColumnDataType() {
        return true;
    }
}
const SELECT_MODIFIER_SQL = freeze({
    ForKeyShare: 'for key share',
    ForNoKeyUpdate: 'for no key update',
    ForUpdate: 'for update',
    ForShare: 'for share',
    NoWait: 'nowait',
    SkipLocked: 'skip locked',
    Distinct: 'distinct',
});
const SELECT_MODIFIER_PRIORITY = freeze({
    ForKeyShare: 1,
    ForNoKeyUpdate: 1,
    ForUpdate: 1,
    ForShare: 1,
    NoWait: 2,
    SkipLocked: 2,
    Distinct: 0,
});
const JOIN_TYPE_SQL = freeze({
    InnerJoin: 'inner join',
    LeftJoin: 'left join',
    RightJoin: 'right join',
    FullJoin: 'full join',
    CrossJoin: 'cross join',
    LateralInnerJoin: 'inner join lateral',
    LateralLeftJoin: 'left join lateral',
    LateralCrossJoin: 'cross join lateral',
    OuterApply: 'outer apply',
    CrossApply: 'cross apply',
    Using: 'using',
});
