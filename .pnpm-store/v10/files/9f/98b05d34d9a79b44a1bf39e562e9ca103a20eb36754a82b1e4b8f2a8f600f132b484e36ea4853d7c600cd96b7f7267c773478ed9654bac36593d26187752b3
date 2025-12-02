const errorMessageWrapper = (message) => `standard-openapi: ${message}`;
const openapiVendorMap = /* @__PURE__ */ new Map();

const getToOpenAPISchemaFn = async (vendor) => {
  const cached = openapiVendorMap.get(vendor);
  if (cached) {
    return cached;
  }
  let vendorFn;
  switch (vendor) {
    case "valibot":
      vendorFn = (await import('./valibot-D_HTw1Gn.js')).default();
      break;
    case "zod":
      vendorFn = (await import('./zod-DSgpEGAE.js')).default();
      break;
    default:
      vendorFn = (await import('./default-u_dwuiYb.js')).default();
  }
  openapiVendorMap.set(vendor, vendorFn);
  return vendorFn;
};

const toOpenAPISchema = async (schema, context = {}) => {
  const fn = await getToOpenAPISchemaFn(schema["~standard"].vendor);
  const { components = {}, options } = context;
  const _schema = await fn(schema, { components, options });
  return {
    schema: _schema,
    components: Object.keys(components).length > 0 ? components : void 0
  };
};
function loadVendor(vendor, fn) {
  openapiVendorMap.set(vendor, fn);
}

export { errorMessageWrapper as e, loadVendor as l, toOpenAPISchema as t };
