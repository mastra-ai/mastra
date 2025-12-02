'use strict';

var zod = require('zod');
var zodToJsonSchemaOriginal = require('zod-to-json-schema');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var zodToJsonSchemaOriginal__default = /*#__PURE__*/_interopDefault(zodToJsonSchemaOriginal);

// src/zod-to-json.ts
var PATCHED = Symbol("__mastra_patched__");
function patchRecordSchemas(schema) {
  if (!schema || typeof schema !== "object") return schema;
  if (schema[PATCHED]) return schema;
  schema[PATCHED] = true;
  const def = schema._zod?.def;
  if (def?.type === "record" && def.keyType && !def.valueType) {
    def.valueType = def.keyType;
    def.keyType = zod.z.string();
  }
  if (!def) return schema;
  if (def.type === "object" && def.shape) {
    const shape = typeof def.shape === "function" ? def.shape() : def.shape;
    for (const key of Object.keys(shape)) {
      patchRecordSchemas(shape[key]);
    }
  }
  if (def.type === "array" && def.element) {
    patchRecordSchemas(def.element);
  }
  if (def.type === "union" && def.options) {
    def.options.forEach(patchRecordSchemas);
  }
  if (def.type === "record") {
    if (def.keyType) patchRecordSchemas(def.keyType);
    if (def.valueType) patchRecordSchemas(def.valueType);
  }
  if (def.type === "intersection") {
    if (def.left) patchRecordSchemas(def.left);
    if (def.right) patchRecordSchemas(def.right);
  }
  if (def.type === "lazy") {
    if (def.getter && typeof def.getter === "function") {
      const originalGetter = def.getter;
      def.getter = function() {
        const innerSchema = originalGetter();
        if (innerSchema) {
          patchRecordSchemas(innerSchema);
        }
        return innerSchema;
      };
    }
  }
  if (def.innerType) {
    patchRecordSchemas(def.innerType);
  }
  return schema;
}
function zodToJsonSchema(zodSchema, target = "jsonSchema7", strategy = "relative") {
  const fn = "toJSONSchema";
  if (fn in zod.z) {
    patchRecordSchemas(zodSchema);
    return zod.z[fn](zodSchema, {
      unrepresentable: "any",
      override: (ctx) => {
        const def = ctx.zodSchema?._def || ctx.zodSchema?._zod?.def;
        if (def && (def.typeName === "ZodDate" || def.type === "date")) {
          ctx.jsonSchema.type = "string";
          ctx.jsonSchema.format = "date-time";
        }
      }
    });
  } else {
    return zodToJsonSchemaOriginal__default.default(zodSchema, {
      $refStrategy: strategy,
      target
    });
  }
}

exports.zodToJsonSchema = zodToJsonSchema;
//# sourceMappingURL=chunk-5WM4A32G.cjs.map
//# sourceMappingURL=chunk-5WM4A32G.cjs.map