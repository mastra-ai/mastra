import { quansync } from 'quansync';

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
      vendorFnPromise = (await import('./arktype-aI7TBD0R.js')).default();
      break;
    case "effect":
      vendorFnPromise = (await import('./effect-QlVUlMFu.js')).default();
      break;
    case "sury":
      vendorFnPromise = (await import('./sury-CWZTCd75.js')).default();
      break;
    case "typebox":
      vendorFnPromise = (await import('./typebox-Dei93FPO.js')).default();
      break;
    case "valibot":
      vendorFnPromise = (await import('./valibot--1zFm7rT.js')).default();
      break;
    case "zod":
      vendorFnPromise = (await import('./zod-Bwrt9trS.js')).default();
      break;
    default:
      throw new UnsupportedVendorError(vendor);
  }
  const vendorFn = await vendorFnPromise;
  validationMapper.set(vendor, vendorFn);
  return vendorFn;
};

const toJsonSchema = quansync({
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

export { MissingDependencyError as M, loadVendor as l, toJsonSchema as t };
