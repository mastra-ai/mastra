import "../../get-model-name-D4DUV7S2.mjs";
import "../../utils-DBbaShi0.mjs";
import "../../crypto-BQxYXGGX.mjs";
import "../../jwt-DzuIBp7t.mjs";
import "../../misc-D8A8FGv2.mjs";
import "../../json-_HMgPUVh.mjs";
import { t as createAdapterFactory } from "../../adapter-factory-oT7pVV1b.mjs";
import { ObjectId } from "mongodb";

//#region src/adapters/mongodb-adapter/mongodb-adapter.ts
const mongodbAdapter = (db, config) => {
	let lazyOptions;
	const getCustomIdGenerator = (options) => {
		const generator = options.advanced?.database?.generateId;
		if (typeof generator === "function") return generator;
	};
	const createCustomAdapter = (db$1, session) => ({ getFieldAttributes, getFieldName, schema, getDefaultModelName, options }) => {
		const customIdGen = getCustomIdGenerator(options);
		function serializeID({ field, value, model }) {
			if (customIdGen) return value;
			model = getDefaultModelName(model);
			if (field === "id" || field === "_id" || schema[model].fields[field]?.references?.field === "id") {
				if (value === null || value === void 0) return value;
				if (typeof value !== "string") {
					if (value instanceof ObjectId) return value;
					if (Array.isArray(value)) return value.map((v) => {
						if (v === null || v === void 0) return v;
						if (typeof v === "string") try {
							return new ObjectId(v);
						} catch (e) {
							return v;
						}
						if (v instanceof ObjectId) return v;
						throw new Error("Invalid id value, recieved: " + JSON.stringify(v));
					});
					throw new Error("Invalid id value, recieved: " + JSON.stringify(value));
				}
				try {
					return new ObjectId(value);
				} catch (e) {
					return value;
				}
			}
			return value;
		}
		function convertWhereClause({ where, model }) {
			if (!where.length) return {};
			const conditions = where.map((w) => {
				const { field: field_, value, operator = "eq", connector = "AND" } = w;
				let condition;
				let field = getFieldName({
					model,
					field: field_
				});
				if (field === "id") field = "_id";
				switch (operator.toLowerCase()) {
					case "eq":
						condition = { [field]: serializeID({
							field,
							value,
							model
						}) };
						break;
					case "in":
						condition = { [field]: { $in: Array.isArray(value) ? value.map((v) => serializeID({
							field,
							value: v,
							model
						})) : [serializeID({
							field,
							value,
							model
						})] } };
						break;
					case "not_in":
						condition = { [field]: { $nin: Array.isArray(value) ? value.map((v) => serializeID({
							field,
							value: v,
							model
						})) : [serializeID({
							field,
							value,
							model
						})] } };
						break;
					case "gt":
						condition = { [field]: { $gt: serializeID({
							field,
							value,
							model
						}) } };
						break;
					case "gte":
						condition = { [field]: { $gte: serializeID({
							field,
							value,
							model
						}) } };
						break;
					case "lt":
						condition = { [field]: { $lt: serializeID({
							field,
							value,
							model
						}) } };
						break;
					case "lte":
						condition = { [field]: { $lte: serializeID({
							field,
							value,
							model
						}) } };
						break;
					case "ne":
						condition = { [field]: { $ne: serializeID({
							field,
							value,
							model
						}) } };
						break;
					case "contains":
						condition = { [field]: { $regex: `.*${escapeForMongoRegex(value)}.*` } };
						break;
					case "starts_with":
						condition = { [field]: { $regex: `^${escapeForMongoRegex(value)}` } };
						break;
					case "ends_with":
						condition = { [field]: { $regex: `${escapeForMongoRegex(value)}$` } };
						break;
					default: throw new Error(`Unsupported operator: ${operator}`);
				}
				return {
					condition,
					connector
				};
			});
			if (conditions.length === 1) return conditions[0].condition;
			const andConditions = conditions.filter((c) => c.connector === "AND").map((c) => c.condition);
			const orConditions = conditions.filter((c) => c.connector === "OR").map((c) => c.condition);
			let clause = {};
			if (andConditions.length) clause = {
				...clause,
				$and: andConditions
			};
			if (orConditions.length) clause = {
				...clause,
				$or: orConditions
			};
			return clause;
		}
		return {
			async create({ model, data: values }) {
				return {
					_id: (await db$1.collection(model).insertOne(values, { session })).insertedId.toString(),
					...values
				};
			},
			async findOne({ model, where, select, join }) {
				const pipeline = [where ? { $match: convertWhereClause({
					where,
					model
				}) } : { $match: {} }];
				if (join) for (const [joinedModel, joinConfig] of Object.entries(join)) {
					const localField = getFieldName({
						field: joinConfig.on.from,
						model
					});
					const foreignField = getFieldName({
						field: joinConfig.on.to,
						model: joinedModel
					});
					const localFieldName = localField === "id" ? "_id" : localField;
					const foreignFieldName = foreignField === "id" ? "_id" : foreignField;
					const isUnique = (schema[getDefaultModelName(joinedModel)]?.fields[joinConfig.on.to])?.unique === true;
					const shouldLimit = !isUnique && joinConfig.limit !== void 0;
					let limit = joinConfig.limit ?? options.advanced?.database?.defaultFindManyLimit ?? 100;
					if (shouldLimit && limit > 0) {
						const foreignFieldRef = `$${foreignFieldName}`;
						pipeline.push({ $lookup: {
							from: joinedModel,
							let: { localFieldValue: `$${localFieldName}` },
							pipeline: [{ $match: { $expr: { $eq: [foreignFieldRef, "$$localFieldValue"] } } }, { $limit: limit }],
							as: joinedModel
						} });
					} else pipeline.push({ $lookup: {
						from: joinedModel,
						localField: localFieldName,
						foreignField: foreignFieldName,
						as: joinedModel
					} });
					if (isUnique) pipeline.push({ $unwind: {
						path: `$${joinedModel}`,
						preserveNullAndEmptyArrays: true
					} });
				}
				if (select) {
					const projection = {};
					select.forEach((field) => {
						projection[getFieldName({
							field,
							model
						})] = 1;
					});
					if (join) for (const joinedModel of Object.keys(join)) projection[joinedModel] = 1;
					pipeline.push({ $project: projection });
				}
				pipeline.push({ $limit: 1 });
				const res = await db$1.collection(model).aggregate(pipeline, { session }).toArray();
				if (!res || res.length === 0) return null;
				return res[0];
			},
			async findMany({ model, where, limit, offset, sortBy, join }) {
				const pipeline = [where ? { $match: convertWhereClause({
					where,
					model
				}) } : { $match: {} }];
				if (join) for (const [joinedModel, joinConfig] of Object.entries(join)) {
					const localField = getFieldName({
						field: joinConfig.on.from,
						model
					});
					const foreignField = getFieldName({
						field: joinConfig.on.to,
						model: joinedModel
					});
					const localFieldName = localField === "id" ? "_id" : localField;
					const foreignFieldName = foreignField === "id" ? "_id" : foreignField;
					const isUnique = getFieldAttributes({
						model: joinedModel,
						field: joinConfig.on.to
					})?.unique === true;
					const shouldLimit = joinConfig.relation !== "one-to-one" && joinConfig.limit !== void 0;
					let limit$1 = joinConfig.limit ?? options.advanced?.database?.defaultFindManyLimit ?? 100;
					if (shouldLimit && limit$1 > 0) {
						const foreignFieldRef = `$${foreignFieldName}`;
						pipeline.push({ $lookup: {
							from: joinedModel,
							let: { localFieldValue: `$${localFieldName}` },
							pipeline: [{ $match: { $expr: { $eq: [foreignFieldRef, "$$localFieldValue"] } } }, { $limit: limit$1 }],
							as: joinedModel
						} });
					} else pipeline.push({ $lookup: {
						from: joinedModel,
						localField: localFieldName,
						foreignField: foreignFieldName,
						as: joinedModel
					} });
					if (isUnique) pipeline.push({ $unwind: {
						path: `$${joinedModel}`,
						preserveNullAndEmptyArrays: true
					} });
				}
				if (sortBy) pipeline.push({ $sort: { [getFieldName({
					field: sortBy.field,
					model
				})]: sortBy.direction === "desc" ? -1 : 1 } });
				if (offset) pipeline.push({ $skip: offset });
				if (limit) pipeline.push({ $limit: limit });
				return await db$1.collection(model).aggregate(pipeline, { session }).toArray();
			},
			async count({ model, where }) {
				const pipeline = [where ? { $match: convertWhereClause({
					where,
					model
				}) } : { $match: {} }, { $count: "total" }];
				const res = await db$1.collection(model).aggregate(pipeline, { session }).toArray();
				if (!res || res.length === 0) return 0;
				return res[0]?.total ?? 0;
			},
			async update({ model, where, update: values }) {
				const clause = convertWhereClause({
					where,
					model
				});
				const doc = (await db$1.collection(model).findOneAndUpdate(clause, { $set: values }, {
					session,
					returnDocument: "after",
					includeResultMetadata: true
				}))?.value ?? null;
				if (!doc) return null;
				return doc;
			},
			async updateMany({ model, where, update: values }) {
				const clause = convertWhereClause({
					where,
					model
				});
				return (await db$1.collection(model).updateMany(clause, { $set: values }, { session })).modifiedCount;
			},
			async delete({ model, where }) {
				const clause = convertWhereClause({
					where,
					model
				});
				await db$1.collection(model).deleteOne(clause, { session });
			},
			async deleteMany({ model, where }) {
				const clause = convertWhereClause({
					where,
					model
				});
				return (await db$1.collection(model).deleteMany(clause, { session })).deletedCount;
			}
		};
	};
	let lazyAdapter = null;
	let adapterOptions = null;
	adapterOptions = {
		config: {
			adapterId: "mongodb-adapter",
			adapterName: "MongoDB Adapter",
			usePlural: config?.usePlural ?? false,
			debugLogs: config?.debugLogs ?? false,
			mapKeysTransformInput: { id: "_id" },
			mapKeysTransformOutput: { _id: "id" },
			supportsNumericIds: false,
			transaction: config?.client && (config?.transaction ?? true) ? async (cb) => {
				if (!config.client) return cb(lazyAdapter(lazyOptions));
				const session = config.client.startSession();
				try {
					session.startTransaction();
					const result = await cb(createAdapterFactory({
						config: adapterOptions.config,
						adapter: createCustomAdapter(db, session)
					})(lazyOptions));
					await session.commitTransaction();
					return result;
				} catch (err) {
					await session.abortTransaction();
					throw err;
				} finally {
					await session.endSession();
				}
			} : false,
			customTransformInput({ action, data, field, fieldAttributes, schema, model, options }) {
				const customIdGen = getCustomIdGenerator(options);
				if (field === "_id" || fieldAttributes.references?.field === "id") {
					if (customIdGen) return data;
					if (action === "update") return data;
					if (Array.isArray(data)) return data.map((v) => {
						if (typeof v === "string") try {
							return new ObjectId(v);
						} catch (error) {
							return v;
						}
						return v;
					});
					if (typeof data === "string") try {
						return new ObjectId(data);
					} catch (error) {
						return data;
					}
					if (fieldAttributes?.references?.field === "id" && !fieldAttributes?.required && data === null) return null;
					return new ObjectId();
				}
				return data;
			},
			customTransformOutput({ data, field, fieldAttributes }) {
				if (field === "id" || fieldAttributes.references?.field === "id") {
					if (data instanceof ObjectId) return data.toHexString();
					if (Array.isArray(data)) return data.map((v) => {
						if (v instanceof ObjectId) return v.toHexString();
						return v;
					});
					return data;
				}
				return data;
			},
			customIdGenerator() {
				return new ObjectId().toString();
			}
		},
		adapter: createCustomAdapter(db)
	};
	lazyAdapter = createAdapterFactory(adapterOptions);
	return (options) => {
		lazyOptions = options;
		return lazyAdapter(options);
	};
};
/**
* Safely escape user input for use in a MongoDB regex.
* This ensures the resulting pattern is treated as literal text,
* and not as a regex with special syntax.
*
* @param input - The input string to escape. Any type that isn't a string will be converted to an empty string.
* @param maxLength - The maximum length of the input string to escape. Defaults to 256. This is to prevent DOS attacks.
* @returns The escaped string.
*/
function escapeForMongoRegex(input, maxLength = 256) {
	if (typeof input !== "string") return "";
	return input.slice(0, maxLength).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//#endregion
export { mongodbAdapter };