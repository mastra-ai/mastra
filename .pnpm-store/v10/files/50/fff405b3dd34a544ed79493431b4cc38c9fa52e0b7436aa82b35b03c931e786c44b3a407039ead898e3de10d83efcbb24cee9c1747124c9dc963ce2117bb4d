'use strict';

var index = require('./index-aBd5wZAR.cjs');
require('quansync');

async function getToJsonSchemaFn() {
  try {
    const { toJSONSchema } = await import('sury');
    return toJSONSchema;
  } catch {
    throw new index.MissingDependencyError("sury");
  }
}

exports.default = getToJsonSchemaFn;
