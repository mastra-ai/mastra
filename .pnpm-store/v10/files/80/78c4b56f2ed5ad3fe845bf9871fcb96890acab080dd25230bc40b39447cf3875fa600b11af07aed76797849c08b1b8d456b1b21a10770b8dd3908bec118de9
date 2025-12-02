'use strict';

var standardJson = require('@standard-community/standard-json');
var convert = require('./vendors/convert.cjs');

function getToOpenAPISchemaFn() {
  return async (schema, context) => {
    const openapiSchema = await standardJson.toJsonSchema(schema, {
      errorMode: "ignore",
      // @ts-expect-error
      overrideAction: ({ valibotAction, jsonSchema }) => {
        const _jsonSchema = convert.convertToOpenAPISchema(jsonSchema, context);
        if (valibotAction.kind === "metadata" && valibotAction.type === "metadata" && !("$ref" in _jsonSchema)) {
          const metadata = valibotAction.metadata;
          if (metadata.example !== void 0) {
            _jsonSchema.example = metadata.example;
          }
          if (metadata.examples && metadata.examples.length > 0) {
            _jsonSchema.examples = metadata.examples;
          }
          if (metadata.ref) {
            context.components.schemas = {
              ...context.components.schemas,
              [metadata.ref]: _jsonSchema
            };
            return {
              $ref: `#/components/schemas/${metadata.ref}`
            };
          }
        }
        return _jsonSchema;
      },
      ...context.options
    });
    if ("$schema" in openapiSchema) {
      delete openapiSchema.$schema;
    }
    return openapiSchema;
  };
}

exports.default = getToOpenAPISchemaFn;
