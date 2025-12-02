'use strict';

var _default = require('./default-DyJyARWC.cjs');
var index = require('./index-CzVFvajF.cjs');
require('@standard-community/standard-json');
require('./vendors/convert.cjs');

function getToOpenAPISchemaFn() {
  return async (schema, context) => {
    if ("_zod" in schema) {
      return _default.default()(schema, {
        components: context.components,
        options: { io: "input", ...context.options }
      });
    }
    try {
      const { createSchema } = await import('zod-openapi');
      const { schema: _schema, components } = createSchema(
        // @ts-expect-error
        schema,
        { schemaType: "input", ...context.options }
      );
      if (components) {
        context.components.schemas = {
          ...context.components.schemas,
          ...components
        };
      }
      return _schema;
    } catch {
      throw new Error(
        index.errorMessageWrapper(`Missing dependencies "zod-openapi v4".`)
      );
    }
  };
}

exports.default = getToOpenAPISchemaFn;
