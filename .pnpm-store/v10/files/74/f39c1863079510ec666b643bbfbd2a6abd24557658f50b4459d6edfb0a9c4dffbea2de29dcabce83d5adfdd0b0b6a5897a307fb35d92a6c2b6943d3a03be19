import { n as getKyselyDatabaseType, t as createKyselyAdapter } from "../../dialect-BvcuosDD.mjs";
import "../../get-model-name-D4DUV7S2.mjs";
import "../../utils-DBbaShi0.mjs";
import "../../crypto-BQxYXGGX.mjs";
import "../../jwt-DzuIBp7t.mjs";
import "../../misc-D8A8FGv2.mjs";
import "../../json-_HMgPUVh.mjs";
import { t as createAdapterFactory } from "../../adapter-factory-oT7pVV1b.mjs";
import { sql } from "kysely";

//#region src/adapters/kysely-adapter/kysely-adapter.ts
const kyselyAdapter = (db, config) => {
	let lazyOptions = null;
	const createCustomAdapter = (db$1) => {
		return ({ getFieldName, schema, getDefaultFieldName, getDefaultModelName, getFieldAttributes, getModelName }) => {
			const selectAllJoins = (join) => {
				const allSelects = [];
				const allSelectsStr = [];
				if (join) for (const [joinModel, _] of Object.entries(join)) {
					const fields = schema[getDefaultModelName(joinModel)]?.fields;
					const [_joinModelSchema, joinModelName] = joinModel.includes(".") ? joinModel.split(".") : [void 0, joinModel];
					if (!fields) continue;
					fields.id = { type: "string" };
					for (const [field, fieldAttr] of Object.entries(fields)) {
						allSelects.push(sql`${sql.ref(`join_${joinModelName}`)}.${sql.ref(fieldAttr.fieldName || field)} as ${sql.ref(`_joined_${joinModelName}_${fieldAttr.fieldName || field}`)}`);
						allSelectsStr.push({
							joinModel,
							joinModelRef: joinModelName,
							fieldName: fieldAttr.fieldName || field
						});
					}
				}
				return {
					allSelectsStr,
					allSelects
				};
			};
			const withReturning = async (values, builder, model, where) => {
				let res;
				if (config?.type === "mysql") {
					await builder.execute();
					const field = values.id ? "id" : where.length > 0 && where[0]?.field ? where[0].field : "id";
					if (!values.id && where.length === 0) {
						res = await db$1.selectFrom(model).selectAll().orderBy(getFieldName({
							model,
							field
						}), "desc").limit(1).executeTakeFirst();
						return res;
					}
					const value = values[field] || where[0]?.value;
					res = await db$1.selectFrom(model).selectAll().orderBy(getFieldName({
						model,
						field
					}), "desc").where(getFieldName({
						model,
						field
					}), "=", value).limit(1).executeTakeFirst();
					return res;
				}
				if (config?.type === "mssql") {
					res = await builder.outputAll("inserted").executeTakeFirst();
					return res;
				}
				res = await builder.returningAll().executeTakeFirst();
				return res;
			};
			function convertWhereClause(model, w) {
				if (!w) return {
					and: null,
					or: null
				};
				const conditions = {
					and: [],
					or: []
				};
				w.forEach((condition) => {
					let { field: _field, value: _value, operator = "=", connector = "AND" } = condition;
					let value = _value;
					let field = getFieldName({
						model,
						field: _field
					});
					const expr = (eb) => {
						const f = `${model}.${field}`;
						if (operator.toLowerCase() === "in") return eb(f, "in", Array.isArray(value) ? value : [value]);
						if (operator.toLowerCase() === "not_in") return eb(f, "not in", Array.isArray(value) ? value : [value]);
						if (operator === "contains") return eb(f, "like", `%${value}%`);
						if (operator === "starts_with") return eb(f, "like", `${value}%`);
						if (operator === "ends_with") return eb(f, "like", `%${value}`);
						if (operator === "eq") return eb(f, "=", value);
						if (operator === "ne") return eb(f, "<>", value);
						if (operator === "gt") return eb(f, ">", value);
						if (operator === "gte") return eb(f, ">=", value);
						if (operator === "lt") return eb(f, "<", value);
						if (operator === "lte") return eb(f, "<=", value);
						return eb(f, operator, value);
					};
					if (connector === "OR") conditions.or.push(expr);
					else conditions.and.push(expr);
				});
				return {
					and: conditions.and.length ? conditions.and : null,
					or: conditions.or.length ? conditions.or : null
				};
			}
			function processJoinedResults(rows, joinConfig, allSelectsStr) {
				if (!joinConfig || !rows.length) return rows;
				const groupedByMainId = /* @__PURE__ */ new Map();
				for (const currentRow of rows) {
					const mainModelFields = {};
					const joinedModelFields = {};
					for (const [joinModel] of Object.entries(joinConfig)) joinedModelFields[getModelName(joinModel)] = {};
					for (const [key, value] of Object.entries(currentRow)) {
						const keyStr = String(key);
						let assigned = false;
						for (const { joinModel, fieldName, joinModelRef } of allSelectsStr) if (keyStr === `_joined_${joinModelRef}_${fieldName}`) {
							joinedModelFields[getModelName(joinModel)][getFieldName({
								model: joinModel,
								field: fieldName
							})] = value;
							assigned = true;
							break;
						}
						if (!assigned) mainModelFields[key] = value;
					}
					const mainId = mainModelFields.id;
					if (!mainId) continue;
					if (!groupedByMainId.has(mainId)) {
						const entry$1 = { ...mainModelFields };
						for (const [joinModel, joinAttr] of Object.entries(joinConfig)) entry$1[getModelName(joinModel)] = joinAttr.relation === "one-to-one" ? null : [];
						groupedByMainId.set(mainId, entry$1);
					}
					const entry = groupedByMainId.get(mainId);
					for (const [joinModel, joinAttr] of Object.entries(joinConfig)) {
						const isUnique = joinAttr.relation === "one-to-one";
						const limit = joinAttr.limit ?? 100;
						const joinedObj = joinedModelFields[getModelName(joinModel)];
						const hasData = joinedObj && Object.keys(joinedObj).length > 0 && Object.values(joinedObj).some((value) => value !== null && value !== void 0);
						if (isUnique) entry[getModelName(joinModel)] = hasData ? joinedObj : null;
						else {
							const joinModelName = getModelName(joinModel);
							if (Array.isArray(entry[joinModelName]) && hasData) {
								if (entry[joinModelName].length >= limit) continue;
								const idFieldName = getFieldName({
									model: joinModel,
									field: "id"
								});
								const joinedId = joinedObj[idFieldName];
								if (joinedId) {
									if (!entry[joinModelName].some((item) => item[idFieldName] === joinedId) && entry[joinModelName].length < limit) entry[joinModelName].push(joinedObj);
								} else if (entry[joinModelName].length < limit) entry[joinModelName].push(joinedObj);
							}
						}
					}
				}
				let result = Array.from(groupedByMainId.values());
				for (const entry of result) for (const [joinModel, joinAttr] of Object.entries(joinConfig)) if (joinAttr.relation !== "one-to-one") {
					const joinModelName = getModelName(joinModel);
					if (Array.isArray(entry[joinModelName])) {
						const limit = joinAttr.limit ?? 100;
						if (entry[joinModelName].length > limit) entry[joinModelName] = entry[joinModelName].slice(0, limit);
					}
				}
				return result;
			}
			return {
				async create({ data, model }) {
					return await withReturning(data, db$1.insertInto(model).values(data), model, []);
				},
				async findOne({ model, where, select, join }) {
					const { and, or } = convertWhereClause(model, where);
					let query = db$1.selectFrom((eb) => {
						let b = eb.selectFrom(model);
						if (and) b = b.where((eb$1) => eb$1.and(and.map((expr) => expr(eb$1))));
						if (or) b = b.where((eb$1) => eb$1.or(or.map((expr) => expr(eb$1))));
						return b.selectAll().as("primary");
					}).selectAll("primary");
					if (join) for (const [joinModel, joinAttr] of Object.entries(join)) {
						const [_joinModelSchema, joinModelName] = joinModel.includes(".") ? joinModel.split(".") : [void 0, joinModel];
						query = query.leftJoin(`${joinModel} as join_${joinModelName}`, (join$1) => join$1.onRef(`join_${joinModelName}.${joinAttr.on.to}`, "=", `primary.${joinAttr.on.from}`));
					}
					const { allSelectsStr, allSelects } = selectAllJoins(join);
					query = query.select(allSelects);
					const res = await query.execute();
					if (!res || !Array.isArray(res) || res.length === 0) return null;
					const row = res[0];
					if (join) return processJoinedResults(res, join, allSelectsStr)[0];
					return row;
				},
				async findMany({ model, where, limit, offset, sortBy, join }) {
					const { and, or } = convertWhereClause(model, where);
					let query = db$1.selectFrom((eb) => {
						let b = eb.selectFrom(model);
						if (config?.type === "mssql") {
							if (offset !== void 0) {
								if (!sortBy) b = b.orderBy(getFieldName({
									model,
									field: "id"
								}));
								b = b.offset(offset).fetch(limit || 100);
							} else if (limit !== void 0) b = b.top(limit);
						} else {
							if (limit !== void 0) b = b.limit(limit);
							if (offset !== void 0) b = b.offset(offset);
						}
						if (sortBy?.field) b = b.orderBy(`${getFieldName({
							model,
							field: sortBy.field
						})}`, sortBy.direction);
						if (and) b = b.where((eb$1) => eb$1.and(and.map((expr) => expr(eb$1))));
						if (or) b = b.where((eb$1) => eb$1.or(or.map((expr) => expr(eb$1))));
						return b.selectAll().as("primary");
					}).selectAll("primary");
					if (join) for (const [joinModel, joinAttr] of Object.entries(join)) {
						const [_joinModelSchema, joinModelName] = joinModel.includes(".") ? joinModel.split(".") : [void 0, joinModel];
						query = query.leftJoin(`${joinModel} as join_${joinModelName}`, (join$1) => join$1.onRef(`join_${joinModelName}.${joinAttr.on.to}`, "=", `primary.${joinAttr.on.from}`));
					}
					const { allSelectsStr, allSelects } = selectAllJoins(join);
					query = query.select(allSelects);
					if (sortBy?.field) query = query.orderBy(`${getFieldName({
						model,
						field: sortBy.field
					})}`, sortBy.direction);
					const res = await query.execute();
					if (!res) return [];
					if (join) return processJoinedResults(res, join, allSelectsStr);
					return res;
				},
				async update({ model, where, update: values }) {
					const { and, or } = convertWhereClause(model, where);
					let query = db$1.updateTable(model).set(values);
					if (and) query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
					if (or) query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
					return await withReturning(values, query, model, where);
				},
				async updateMany({ model, where, update: values }) {
					const { and, or } = convertWhereClause(model, where);
					let query = db$1.updateTable(model).set(values);
					if (and) query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
					if (or) query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
					return (await query.execute()).length;
				},
				async count({ model, where }) {
					const { and, or } = convertWhereClause(model, where);
					let query = db$1.selectFrom(model).select(db$1.fn.count("id").as("count"));
					if (and) query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
					if (or) query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
					const res = await query.execute();
					if (typeof res[0].count === "number") return res[0].count;
					if (typeof res[0].count === "bigint") return Number(res[0].count);
					return parseInt(res[0].count);
				},
				async delete({ model, where }) {
					const { and, or } = convertWhereClause(model, where);
					let query = db$1.deleteFrom(model);
					if (and) query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
					if (or) query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
					await query.execute();
				},
				async deleteMany({ model, where }) {
					const { and, or } = convertWhereClause(model, where);
					let query = db$1.deleteFrom(model);
					if (and) query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
					if (or) query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
					return (await query.execute()).length;
				},
				options: config
			};
		};
	};
	let adapterOptions = null;
	adapterOptions = {
		config: {
			adapterId: "kysely",
			adapterName: "Kysely Adapter",
			usePlural: config?.usePlural,
			debugLogs: config?.debugLogs,
			supportsBooleans: config?.type === "sqlite" || config?.type === "mssql" || config?.type === "mysql" || !config?.type ? false : true,
			supportsDates: config?.type === "sqlite" || config?.type === "mssql" || !config?.type ? false : true,
			supportsJSON: false,
			supportsUUIDs: config?.type === "postgres" ? true : false,
			transaction: config?.transaction ? (cb) => db.transaction().execute((trx) => {
				return cb(createAdapterFactory({
					config: adapterOptions.config,
					adapter: createCustomAdapter(trx)
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
export { createKyselyAdapter, getKyselyDatabaseType, kyselyAdapter };