'use strict';

var standardJson = require('@standard-community/standard-json');
var convert = require('./vendors/convert.cjs');

function getToOpenAPISchemaFn() {
  return async (schema, context) => convert.convertToOpenAPISchema(
    await standardJson.toJsonSchema(schema, context.options),
    context
  );
}

exports.default = getToOpenAPISchemaFn;
