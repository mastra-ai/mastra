'use strict';

var quansync = require('quansync');

const validationMapper = /* @__PURE__ */ new Map();
class UnsupportedVendorError extends Error {
  constructor(vendor) {
    super(`standard-json: Unsupported schema vendor "${vendor}".`);
  }
}
class MissingDependencyError extends Error {
  constructor(packageName) {
    super(`standard-json: Missing dependencies "${packageName}".`);
  }
}

const getToJsonSchemaFn = async (vendor) => {
  const cached = validationMapper.get(vendor);
  if (cached) {
    return cached;
  }
  let vendorFnPromise;
  switch (vendor) {
    case "arktype":
      vendorFnPromise = (await Promise.resolve().then(function () { return require('./arktype-dE563TQ0.cjs'); })).default();
      break;
    case "effect":
      vendorFnPromise = (await Promise.resolve().then(function () { return require('./effect-IriD2QG7.cjs'); })).default();
      break;
    case "sury":
      vendorFnPromise = (await Promise.resolve().then(function () { return require('./sury-79aC8rnF.cjs'); })).default();
      break;
    case "typebox":
      vendorFnPromise = (await Promise.resolve().then(function () { return require('./typebox-DYb9QD5O.cjs'); })).default();
      break;
    case "valibot":
      vendorFnPromise = (await Promise.resolve().then(function () { return require('./valibot-DKumHSJb.cjs'); })).default();
      break;
    case "zod":
      vendorFnPromise = (await Promise.resolve().then(function () { return require('./zod-BSYBZsr2.cjs'); })).default();
      break;
    default:
      throw new UnsupportedVendorError(vendor);
  }
  const vendorFn = await vendorFnPromise;
  validationMapper.set(vendor, vendorFn);
  return vendorFn;
};

const toJsonSchema = quansync.quansync({
  sync: (schema, options) => {
    const vendor = schema["~standard"].vendor;
    const fn = validationMapper.get(vendor);
    if (!fn) {
      throw new UnsupportedVendorError(vendor);
    }
    return fn(schema, options);
  },
  async: async (schema, options) => {
    const fn = await getToJsonSchemaFn(schema["~standard"].vendor);
    return fn(schema, options);
  }
});
function loadVendor(vendor, fn) {
  validationMapper.set(vendor, fn);
}

exports.MissingDependencyError = MissingDependencyError;
exports.loadVendor = loadVendor;
exports.toJsonSchema = toJsonSchema;
