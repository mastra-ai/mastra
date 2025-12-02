"use strict";
import { z } from "zod";
import {
  componentDefinitionPath,
  componentFunctionPath,
  componentPath
} from "./paths.js";
import { identifier } from "./types.js";
import { looseObject } from "./utils.js";
export const resource = z.union([
  looseObject({ type: z.literal("value"), value: z.string() }),
  looseObject({
    type: z.literal("function"),
    path: componentFunctionPath
  })
]);
export const checkedExport = z.lazy(
  () => z.union([
    looseObject({
      type: z.literal("branch"),
      children: z.record(identifier, checkedExport)
    }),
    looseObject({
      type: z.literal("leaf"),
      resource
    })
  ])
);
export const httpActionRoute = looseObject({
  method: z.string(),
  path: z.string()
});
export const checkedHttpRoutes = looseObject({
  httpModuleRoutes: z.nullable(z.array(httpActionRoute)),
  mounts: z.array(z.string())
});
export const checkedComponent = z.lazy(
  () => looseObject({
    definitionPath: componentDefinitionPath,
    componentPath,
    args: z.record(identifier, resource),
    childComponents: z.record(identifier, checkedComponent),
    httpRoutes: checkedHttpRoutes,
    exports: z.record(identifier, checkedExport)
  })
);
//# sourceMappingURL=checkedComponent.js.map
