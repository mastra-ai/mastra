import "../../get-model-name-D4DUV7S2.mjs";
import "../../utils-DBbaShi0.mjs";
import "../../crypto-BQxYXGGX.mjs";
import "../../jwt-DzuIBp7t.mjs";
import "../../misc-D8A8FGv2.mjs";
import "../../json-_HMgPUVh.mjs";
import { t as createAdapterFactory } from "../../adapter-factory-oT7pVV1b.mjs";
import { logger } from "@better-auth/core/env";
import { BetterAuthError } from "@better-auth/core/error";
import { and, asc, count, desc, eq, gt, gte, inArray, like, lt, lte, ne, notInArray, or, sql } from "drizzle-orm";

//#region src/adapters/drizzle-adapter/drizzle-adapter.ts
const drizzleAdapter = (db, config) => {
	let lazyOptions = null;
	const createCustomAdapter = (db$1) => ({ getFieldName, options }) => {
		function getSchema(model) {
			const schema = config.schema || db$1._.fullSchema;
			if (!schema) throw new BetterAuthError("Drizzle adapter failed to initialize. Schema not found. Please provide a schema object in the adapter options object.");
			const schemaModel = schema[model];
			if (!schemaModel) throw new BetterAuthError(`[# Drizzle Adapter]: The model "${model}" was not found in the schema object. Please pass the schema directly to the adapter options.`);
			return schemaModel;
		}
		const withReturning = async (model, builder, data, where) => {
			if (config.provider !== "mysql") return (await builder.returning())[0];
			await builder.execute();
			const schemaModel = getSchema(model);
			const builderVal = builder.config?.values;
			if (where?.length) {
				const clause = convertWhereClause(where.map((w) => {
					if (data[w.field] !== void 0) return {
						...w,
						value: data[w.field]
					};
					return w;
				}), model);
				return (await db$1.select().from(schemaModel).where(...clause))[0];
			} else if (builderVal && builderVal[0]?.id?.value) {
				let tId = builderVal[0]?.id?.value;
				if (!tId) tId = (await db$1.select({ id: sql`LAST_INSERT_ID()` }).from(schemaModel).orderBy(desc(schemaModel.id)).limit(1))[0].id;
				return (await db$1.select().from(schemaModel).where(eq(schemaModel.id, tId)).limit(1).execute())[0];
			} else if (data.id) return (await db$1.select().from(schemaModel).where(eq(schemaModel.id, data.id)).limit(1).execute())[0];
			else {
				if (!("id" in schemaModel)) throw new BetterAuthError(`The model "${model}" does not have an "id" field. Please use the "id" field as your primary key.`);
				return (await db$1.select().from(schemaModel).orderBy(desc(schemaModel.id)).limit(1).execute())[0];
			}
		};
		function convertWhereClause(where, model) {
			const schemaModel = getSchema(model);
			if (!where) return [];
			if (where.length === 1) {
				const w = where[0];
				if (!w) return [];
				const field = getFieldName({
					model,
					field: w.field
				});
				if (!schemaModel[field]) throw new BetterAuthError(`The field "${w.field}" does not exist in the schema for the model "${model}". Please update your schema.`);
				if (w.operator === "in") {
					if (!Array.isArray(w.value)) throw new BetterAuthError(`The value for the field "${w.field}" must be an array when using the "in" operator.`);
					return [inArray(schemaModel[field], w.value)];
				}
				if (w.operator === "not_in") {
					if (!Array.isArray(w.value)) throw new BetterAuthError(`The value for the field "${w.field}" must be an array when using the "not_in" operator.`);
					return [notInArray(schemaModel[field], w.value)];
				}
				if (w.operator === "contains") return [like(schemaModel[field], `%${w.value}%`)];
				if (w.operator === "starts_with") return [like(schemaModel[field], `${w.value}%`)];
				if (w.operator === "ends_with") return [like(schemaModel[field], `%${w.value}`)];
				if (w.operator === "lt") return [lt(schemaModel[field], w.value)];
				if (w.operator === "lte") return [lte(schemaModel[field], w.value)];
				if (w.operator === "ne") return [ne(schemaModel[field], w.value)];
				if (w.operator === "gt") return [gt(schemaModel[field], w.value)];
				if (w.operator === "gte") return [gte(schemaModel[field], w.value)];
				return [eq(schemaModel[field], w.value)];
			}
			const andGroup = where.filter((w) => w.connector === "AND" || !w.connector);
			const orGroup = where.filter((w) => w.connector === "OR");
			const andClause = and(...andGroup.map((w) => {
				const field = getFieldName({
					model,
					field: w.field
				});
				if (w.operator === "in") {
					if (!Array.isArray(w.value)) throw new BetterAuthError(`The value for the field "${w.field}" must be an array when using the "in" operator.`);
					return inArray(schemaModel[field], w.value);
				}
				if (w.operator === "not_in") {
					if (!Array.isArray(w.value)) throw new BetterAuthError(`The value for the field "${w.field}" must be an array when using the "not_in" operator.`);
					return notInArray(schemaModel[field], w.value);
				}
				if (w.operator === "contains") return like(schemaModel[field], `%${w.value}%`);
				if (w.operator === "starts_with") return like(schemaModel[field], `${w.value}%`);
				if (w.operator === "ends_with") return like(schemaModel[field], `%${w.value}`);
				if (w.operator === "lt") return lt(schemaModel[field], w.value);
				if (w.operator === "lte") return lte(schemaModel[field], w.value);
				if (w.operator === "gt") return gt(schemaModel[field], w.value);
				if (w.operator === "gte") return gte(schemaModel[field], w.value);
				if (w.operator === "ne") return ne(schemaModel[field], w.value);
				return eq(schemaModel[field], w.value);
			}));
			const orClause = or(...orGroup.map((w) => {
				const field = getFieldName({
					model,
					field: w.field
				});
				if (w.operator === "in") {
					if (!Array.isArray(w.value)) throw new BetterAuthError(`The value for the field "${w.field}" must be an array when using the "in" operator.`);
					return inArray(schemaModel[field], w.value);
				}
				if (w.operator === "not_in") {
					if (!Array.isArray(w.value)) throw new BetterAuthError(`The value for the field "${w.field}" must be an array when using the "not_in" operator.`);
					return notInArray(schemaModel[field], w.value);
				}
				if (w.operator === "contains") return like(schemaModel[field], `%${w.value}%`);
				if (w.operator === "starts_with") return like(schemaModel[field], `${w.value}%`);
				if (w.operator === "ends_with") return like(schemaModel[field], `%${w.value}`);
				if (w.operator === "lt") return lt(schemaModel[field], w.value);
				if (w.operator === "lte") return lte(schemaModel[field], w.value);
				if (w.operator === "gt") return gt(schemaModel[field], w.value);
				if (w.operator === "gte") return gte(schemaModel[field], w.value);
				if (w.operator === "ne") return ne(schemaModel[field], w.value);
				return eq(schemaModel[field], w.value);
			}));
			const clause = [];
			if (andGroup.length) clause.push(andClause);
			if (orGroup.length) clause.push(orClause);
			return clause;
		}
		function checkMissingFields(schema, model, values) {
			if (!schema) throw new BetterAuthError("Drizzle adapter failed to initialize. Drizzle Schema not found. Please provide a schema object in the adapter options object.");
			for (const key in values) if (!schema[key]) throw new BetterAuthError(`The field "${key}" does not exist in the "${model}" Drizzle schema. Please update your drizzle schema or re-generate using "npx @better-auth/cli@latest generate".`);
		}
		return {
			async create({ model, data: values }) {
				const schemaModel = getSchema(model);
				checkMissingFields(schemaModel, model, values);
				return await withReturning(model, db$1.insert(schemaModel).values(values), values);
			},
			async findOne({ model, where, join }) {
				const schemaModel = getSchema(model);
				const clause = convertWhereClause(where, model);
				if (options.experimental?.joins) if (!db$1.query || !db$1.query[model]) {
					logger.error(`[# Drizzle Adapter]: The model "${model}" was not found in the query object. Please update your Drizzle schema to include relations or re-generate using "npx @better-auth/cli@latest generate".`);
					logger.info("Falling back to regular query");
				} else {
					let includes;
					const pluralJoinResults = [];
					if (join) {
						includes = {};
						const joinEntries = Object.entries(join);
						for (const [model$1, joinAttr] of joinEntries) {
							const limit = joinAttr.limit ?? options.advanced?.database?.defaultFindManyLimit ?? 100;
							const isUnique = joinAttr.relation === "one-to-one";
							const pluralSuffix = isUnique || config.usePlural ? "" : "s";
							includes[`${model$1}${pluralSuffix}`] = isUnique ? true : { limit };
							if (!isUnique) pluralJoinResults.push(`${model$1}${pluralSuffix}`);
						}
					}
					const res$1 = await db$1.query[model].findFirst({
						where: clause[0],
						with: includes
					});
					if (res$1) for (const pluralJoinResult of pluralJoinResults) {
						let singularKey = !config.usePlural ? pluralJoinResult.slice(0, -1) : pluralJoinResult;
						res$1[singularKey] = res$1[pluralJoinResult];
						if (pluralJoinResult !== singularKey) delete res$1[pluralJoinResult];
					}
					return res$1;
				}
				const res = await db$1.select().from(schemaModel).where(...clause);
				if (!res.length) return null;
				return res[0];
			},
			async findMany({ model, where, sortBy, limit, offset, join }) {
				const schemaModel = getSchema(model);
				const clause = where ? convertWhereClause(where, model) : [];
				const sortFn = sortBy?.direction === "desc" ? desc : asc;
				if (options.experimental?.joins) if (!db$1.query[model]) {
					logger.error(`[# Drizzle Adapter]: The model "${model}" was not found in the query object. Please update your Drizzle schema to include relations or re-generate using "npx @better-auth/cli@latest generate".`);
					logger.info("Falling back to regular query");
				} else {
					let includes;
					const pluralJoinResults = [];
					if (join) {
						includes = {};
						const joinEntries = Object.entries(join);
						for (const [model$1, joinAttr] of joinEntries) {
							const isUnique = joinAttr.relation === "one-to-one";
							const limit$1 = joinAttr.limit ?? options.advanced?.database?.defaultFindManyLimit ?? 100;
							let pluralSuffix = isUnique || config.usePlural ? "" : "s";
							includes[`${model$1}${pluralSuffix}`] = isUnique ? true : { limit: limit$1 };
							if (!isUnique) pluralJoinResults.push(`${model$1}${pluralSuffix}`);
						}
					}
					let orderBy = void 0;
					if (sortBy?.field) orderBy = [sortFn(schemaModel[getFieldName({
						model,
						field: sortBy?.field
					})])];
					let res = await db$1.query[model].findMany({
						where: clause[0],
						with: includes,
						limit: limit ?? 100,
						offset: offset ?? 0,
						orderBy
					});
					if (res) for (const item of res) for (const pluralJoinResult of pluralJoinResults) {
						const singularKey = !config.usePlural ? pluralJoinResult.slice(0, -1) : pluralJoinResult;
						if (singularKey === pluralJoinResult) continue;
						item[singularKey] = item[pluralJoinResult];
						delete item[pluralJoinResult];
					}
					return res;
				}
				let builder = db$1.select().from(schemaModel);
				const effectiveLimit = limit;
				const effectiveOffset = offset;
				if (typeof effectiveLimit !== "undefined") builder = builder.limit(effectiveLimit);
				if (typeof effectiveOffset !== "undefined") builder = builder.offset(effectiveOffset);
				if (sortBy?.field) builder = builder.orderBy(sortFn(schemaModel[getFieldName({
					model,
					field: sortBy?.field
				})]));
				return await builder.where(...clause);
			},
			async count({ model, where }) {
				const schemaModel = getSchema(model);
				const clause = where ? convertWhereClause(where, model) : [];
				return (await db$1.select({ count: count() }).from(schemaModel).where(...clause))[0].count;
			},
			async update({ model, where, update: values }) {
				const schemaModel = getSchema(model);
				const clause = convertWhereClause(where, model);
				return await withReturning(model, db$1.update(schemaModel).set(values).where(...clause), values, where);
			},
			async updateMany({ model, where, update: values }) {
				const schemaModel = getSchema(model);
				const clause = convertWhereClause(where, model);
				return await db$1.update(schemaModel).set(values).where(...clause);
			},
			async delete({ model, where }) {
				const schemaModel = getSchema(model);
				const clause = convertWhereClause(where, model);
				return await db$1.delete(schemaModel).where(...clause);
			},
			async deleteMany({ model, where }) {
				const schemaModel = getSchema(model);
				const clause = convertWhereClause(where, model);
				const res = await db$1.delete(schemaModel).where(...clause);
				let count$1 = 0;
				if (res && "rowCount" in res) count$1 = res.rowCount;
				else if (Array.isArray(res)) count$1 = res.length;
				else if (res && ("affectedRows" in res || "rowsAffected" in res || "changes" in res)) count$1 = res.affectedRows ?? res.rowsAffected ?? res.changes;
				if (typeof count$1 !== "number") logger.error("[Drizzle Adapter] The result of the deleteMany operation is not a number. This is likely a bug in the adapter. Please report this issue to the Better Auth team.", {
					res,
					model,
					where
				});
				return count$1;
			},
			options: config
		};
	};
	let adapterOptions = null;
	adapterOptions = {
		config: {
			adapterId: "drizzle",
			adapterName: "Drizzle Adapter",
			usePlural: config.usePlural ?? false,
			debugLogs: config.debugLogs ?? false,
			supportsUUIDs: config.provider === "pg" ? true : false,
			transaction: config.transaction ?? false ? (cb) => db.transaction((tx) => {
				return cb(createAdapterFactory({
					config: adapterOptions.config,
					adapter: createCustomAdapter(tx)
				})(lazyOptions));
			}) : false
		},
		adapter: createCustomAdapter(db)
	};
	const adapter = createAdapterFactory(adapterOptions);
	return (options) => {
		lazyOptions = options;
		return adapter(options);
	};
};

//#endregion
export { drizzleAdapter };