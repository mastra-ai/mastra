'use strict';

var index = require('./index-aBd5wZAR.cjs');
require('quansync');

async function getToJsonSchemaFn() {
  try {
    const { toJsonSchema } = await import('@valibot/to-json-schema');
    return toJsonSchema;
  } catch {
    throw new index.MissingDependencyError("@valibot/to-json-schema");
  }
}

exports.default = getToJsonSchemaFn;
