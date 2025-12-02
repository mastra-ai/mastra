
//#region src/components/execution/otel/access.ts
/**
* A map of Inngest clients to their OTel span processors. This is used to
* ensure that we only create one span processor per client, and that we can
* access the span processor from the client without exposing the OTel
* libraries to the user.
*/
const clientProcessorMap = /* @__PURE__ */ new WeakMap();

//#endregion
exports.clientProcessorMap = clientProcessorMap;
//# sourceMappingURL=access.cjs.map