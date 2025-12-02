'use strict';

var index = require('./index-aBd5wZAR.cjs');
require('quansync');

async function getToJsonSchemaFn() {
  try {
    const { JSONSchema } = await import('effect');
    return (schema) => JSONSchema.make(schema);
  } catch {
    throw new index.MissingDependencyError("effect");
  }
}

exports.default = getToJsonSchemaFn;
