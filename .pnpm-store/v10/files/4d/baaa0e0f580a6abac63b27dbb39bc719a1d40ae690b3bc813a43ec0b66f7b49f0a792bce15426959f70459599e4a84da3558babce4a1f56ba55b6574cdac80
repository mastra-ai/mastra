'use strict';

var index = require('./index-aBd5wZAR.cjs');
require('quansync');

const zodv4Error = new index.MissingDependencyError("zod v4");
async function getToJsonSchemaFn() {
  return async (schema, options) => {
    let handler;
    if ("_zod" in schema) {
      try {
        const mod = await import('zod/v4/core');
        handler = mod.toJSONSchema;
      } catch {
        throw zodv4Error;
      }
    } else {
      try {
        const mod = await import('zod-to-json-schema');
        handler = mod.zodToJsonSchema;
      } catch {
        throw new index.MissingDependencyError("zod-to-json-schema");
      }
    }
    return handler(schema, options);
  };
}

exports.default = getToJsonSchemaFn;
