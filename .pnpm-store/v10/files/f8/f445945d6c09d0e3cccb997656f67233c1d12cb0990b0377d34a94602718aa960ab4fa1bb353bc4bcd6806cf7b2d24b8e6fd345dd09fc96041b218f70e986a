"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var checkedComponent_exports = {};
__export(checkedComponent_exports, {
  checkedComponent: () => checkedComponent,
  checkedExport: () => checkedExport,
  checkedHttpRoutes: () => checkedHttpRoutes,
  httpActionRoute: () => httpActionRoute,
  resource: () => resource
});
module.exports = __toCommonJS(checkedComponent_exports);
var import_zod = require("zod");
var import_paths = require("./paths.js");
var import_types = require("./types.js");
var import_utils = require("./utils.js");
const resource = import_zod.z.union([
  (0, import_utils.looseObject)({ type: import_zod.z.literal("value"), value: import_zod.z.string() }),
  (0, import_utils.looseObject)({
    type: import_zod.z.literal("function"),
    path: import_paths.componentFunctionPath
  })
]);
const checkedExport = import_zod.z.lazy(
  () => import_zod.z.union([
    (0, import_utils.looseObject)({
      type: import_zod.z.literal("branch"),
      children: import_zod.z.record(import_types.identifier, checkedExport)
    }),
    (0, import_utils.looseObject)({
      type: import_zod.z.literal("leaf"),
      resource
    })
  ])
);
const httpActionRoute = (0, import_utils.looseObject)({
  method: import_zod.z.string(),
  path: import_zod.z.string()
});
const checkedHttpRoutes = (0, import_utils.looseObject)({
  httpModuleRoutes: import_zod.z.nullable(import_zod.z.array(httpActionRoute)),
  mounts: import_zod.z.array(import_zod.z.string())
});
const checkedComponent = import_zod.z.lazy(
  () => (0, import_utils.looseObject)({
    definitionPath: import_paths.componentDefinitionPath,
    componentPath: import_paths.componentPath,
    args: import_zod.z.record(import_types.identifier, resource),
    childComponents: import_zod.z.record(import_types.identifier, checkedComponent),
    httpRoutes: checkedHttpRoutes,
    exports: import_zod.z.record(import_types.identifier, checkedExport)
  })
);
//# sourceMappingURL=checkedComponent.js.map
