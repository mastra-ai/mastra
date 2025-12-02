import "../../get-model-name-D4DUV7S2.mjs";
import "../../utils-DBbaShi0.mjs";
import "../../crypto-BQxYXGGX.mjs";
import "../../jwt-DzuIBp7t.mjs";
import "../../misc-D8A8FGv2.mjs";
import "../../json-_HMgPUVh.mjs";
import { t as createAdapterFactory } from "../../adapter-factory-oT7pVV1b.mjs";
import { BetterAuthError } from "@better-auth/core/error";

//#region src/adapters/prisma-adapter/prisma-adapter.ts
const prismaAdapter = (prisma, config) => {
	let lazyOptions = null;
	const createCustomAdapter = (prisma$1) => ({ getFieldName, getModelName, getFieldAttributes, getDefaultModelName, schema }) => {
		const db = prisma$1;
		const convertSelect = (select, model, join) => {
			if (!select && !join) return void 0;
			let result = {};
			if (select) for (const field of select) result[getFieldName({
				model,
				field
			})] = true;
			if (join) {
				if (!select) {
					const fields = schema[getDefaultModelName(model)]?.fields || {};
					fields.id = { type: "string" };
					for (const field of Object.keys(fields)) result[getFieldName({
						model,
						field
					})] = true;
				}
				for (const [joinModel, joinAttr] of Object.entries(join)) {
					const key = getJoinKeyName(model, getModelName(joinModel), schema);
					if (joinAttr.relation === "one-to-one") result[key] = true;
					else result[key] = { take: joinAttr.limit };
				}
			}
			return result;
		};
		/**
		* Build the join key name based on whether the foreign field is unique or not.
		* If unique, use singular. Otherwise, pluralize (add 's').
		*/
		const getJoinKeyName = (baseModel, joinedModel, schema$1) => {
			try {
				const defaultBaseModelName = getDefaultModelName(baseModel);
				const defaultJoinedModelName = getDefaultModelName(joinedModel);
				const key = getModelName(joinedModel).toLowerCase();
				let foreignKeys = Object.entries(schema$1[defaultJoinedModelName]?.fields || {}).filter(([_field, fieldAttributes]) => fieldAttributes.references && getDefaultModelName(fieldAttributes.references.model) === defaultBaseModelName);
				if (foreignKeys.length > 0) {
					const [_foreignKey, foreignKeyAttributes] = foreignKeys[0];
					return foreignKeyAttributes?.unique === true || config.usePlural === true ? key : `${key}s`;
				}
				foreignKeys = Object.entries(schema$1[defaultBaseModelName]?.fields || {}).filter(([_field, fieldAttributes]) => fieldAttributes.references && getDefaultModelName(fieldAttributes.references.model) === defaultJoinedModelName);
				if (foreignKeys.length > 0) return key;
			} catch {}
			return `${getModelName(joinedModel).toLowerCase()}s`;
		};
		function operatorToPrismaOperator(operator) {
			switch (operator) {
				case "starts_with": return "startsWith";
				case "ends_with": return "endsWith";
				case "ne": return "not";
				case "not_in": return "notIn";
				default: return operator;
			}
		}
		const convertWhereClause = (model, where) => {
			if (!where || !where.length) return {};
			const buildSingleCondition = (w) => {
				const fieldName = getFieldName({
					model,
					field: w.field
				});
				if (w.operator === "ne" && w.value === null) return {};
				if ((w.operator === "in" || w.operator === "not_in") && Array.isArray(w.value)) {
					const filtered = w.value.filter((v) => v != null);
					if (filtered.length === 0) if (w.operator === "in") return { AND: [{ [fieldName]: { equals: "__never__" } }, { [fieldName]: { not: "__never__" } }] };
					else return {};
					const prismaOp = operatorToPrismaOperator(w.operator);
					return { [fieldName]: { [prismaOp]: filtered } };
				}
				if (w.operator === "eq" || !w.operator) return { [fieldName]: w.value };
				return { [fieldName]: { [operatorToPrismaOperator(w.operator)]: w.value } };
			};
			if (where.length === 1) {
				const w = where[0];
				if (!w) return;
				return buildSingleCondition(w);
			}
			const and = where.filter((w) => w.connector === "AND" || !w.connector);
			const or = where.filter((w) => w.connector === "OR");
			const andClause = and.map((w) => buildSingleCondition(w));
			const orClause = or.map((w) => buildSingleCondition(w));
			return {
				...andClause.length ? { AND: andClause } : {},
				...orClause.length ? { OR: orClause } : {}
			};
		};
		return {
			async create({ model, data: values, select }) {
				if (!db[model]) throw new BetterAuthError(`Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`);
				return await db[model].create({
					data: values,
					select: convertSelect(select, model)
				});
			},
			async findOne({ model, where, select, join }) {
				const whereClause = convertWhereClause(model, where);
				if (!db[model]) throw new BetterAuthError(`Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`);
				let map = /* @__PURE__ */ new Map();
				for (const joinModel of Object.keys(join ?? {})) {
					const key = getJoinKeyName(model, joinModel, schema);
					map.set(key, getModelName(joinModel));
				}
				const selects = convertSelect(select, model, join);
				let result = (await db[model].findMany({
					where: whereClause,
					select: selects,
					take: 1
				}))[0];
				if (join && result) for (const [includeKey, originalKey] of map.entries()) {
					if (includeKey === originalKey) continue;
					if (includeKey in result) {
						result[originalKey] = result[includeKey];
						delete result[includeKey];
					}
				}
				return result;
			},
			async findMany({ model, where, limit, offset, sortBy, join }) {
				const whereClause = convertWhereClause(model, where);
				if (!db[model]) throw new BetterAuthError(`Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`);
				let map = /* @__PURE__ */ new Map();
				if (join) for (const [joinModel, value] of Object.entries(join)) {
					const key = getJoinKeyName(model, joinModel, schema);
					map.set(key, getModelName(joinModel));
				}
				const selects = convertSelect(void 0, model, join);
				const result = await db[model].findMany({
					where: whereClause,
					take: limit || 100,
					skip: offset || 0,
					...sortBy?.field ? { orderBy: { [getFieldName({
						model,
						field: sortBy.field
					})]: sortBy.direction === "desc" ? "desc" : "asc" } } : {},
					select: selects
				});
				if (join && Array.isArray(result)) for (const item of result) for (const [includeKey, originalKey] of map.entries()) {
					if (includeKey === originalKey) continue;
					if (includeKey in item) {
						item[originalKey] = item[includeKey];
						delete item[includeKey];
					}
				}
				return result;
			},
			async count({ model, where }) {
				const whereClause = convertWhereClause(model, where);
				if (!db[model]) throw new BetterAuthError(`Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`);
				return await db[model].count({ where: whereClause });
			},
			async update({ model, where, update }) {
				if (!db[model]) throw new BetterAuthError(`Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`);
				const whereClause = convertWhereClause(model, where);
				return await db[model].update({
					where: whereClause,
					data: update
				});
			},
			async updateMany({ model, where, update }) {
				if (!db[model]) throw new BetterAuthError(`Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`);
				const whereClause = convertWhereClause(model, where);
				const result = await db[model].updateMany({
					where: whereClause,
					data: update
				});
				return result ? result.count : 0;
			},
			async delete({ model, where }) {
				if (!db[model]) throw new BetterAuthError(`Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`);
				const whereClause = convertWhereClause(model, where);
				try {
					await db[model].delete({ where: whereClause });
				} catch (e) {
					if (e?.meta?.cause === "Record to delete does not exist.") return;
					console.log(e);
				}
			},
			async deleteMany({ model, where }) {
				const whereClause = convertWhereClause(model, where);
				const result = await db[model].deleteMany({ where: whereClause });
				return result ? result.count : 0;
			},
			options: config
		};
	};
	let adapterOptions = null;
	adapterOptions = {
		config: {
			adapterId: "prisma",
			adapterName: "Prisma Adapter",
			usePlural: config.usePlural ?? false,
			debugLogs: config.debugLogs ?? false,
			supportsUUIDs: config.provider === "postgresql" ? true : false,
			transaction: config.transaction ?? false ? (cb) => prisma.$transaction((tx) => {
				return cb(createAdapterFactory({
					config: adapterOptions.config,
					adapter: createCustomAdapter(tx)
				})(lazyOptions));
			}) : false
		},
		adapter: createCustomAdapter(prisma)
	};
	const adapter = createAdapterFactory(adapterOptions);
	return (options) => {
		lazyOptions = options;
		return adapter(options);
	};
};

//#endregion
export { prismaAdapter };