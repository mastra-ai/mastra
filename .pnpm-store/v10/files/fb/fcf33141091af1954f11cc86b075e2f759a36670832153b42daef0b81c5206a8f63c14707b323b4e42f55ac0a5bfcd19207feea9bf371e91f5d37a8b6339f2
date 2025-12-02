import { z } from "zod";
import {
  componentDefinitionPath,
  componentFunctionPath,
  ComponentDefinitionPath,
  ComponentPath,
  componentPath,
} from "./paths.js";
import { Identifier, identifier } from "./types.js";
import { looseObject } from "./utils.js";

export const resource = z.union([
  looseObject({ type: z.literal("value"), value: z.string() }),
  looseObject({
    type: z.literal("function"),
    path: componentFunctionPath,
  }),
]);
export type Resource = z.infer<typeof resource>;

export type CheckedExport =
  | { type: "branch"; children: Record<Identifier, CheckedExport> }
  | { type: "leaf"; resource: Resource };
export const checkedExport: z.ZodType<CheckedExport> = z.lazy(() =>
  z.union([
    looseObject({
      type: z.literal("branch"),
      children: z.record(identifier, checkedExport),
    }),
    looseObject({
      type: z.literal("leaf"),
      resource,
    }),
  ]),
);

export const httpActionRoute = looseObject({
  method: z.string(),
  path: z.string(),
});

export const checkedHttpRoutes = looseObject({
  httpModuleRoutes: z.nullable(z.array(httpActionRoute)),
  mounts: z.array(z.string()),
});
export type CheckedHttpRoutes = z.infer<typeof checkedHttpRoutes>;

export type CheckedComponent = {
  definitionPath: ComponentDefinitionPath;
  componentPath: ComponentPath;
  args: Record<Identifier, Resource>;
  childComponents: Record<Identifier, CheckedComponent>;
};
export const checkedComponent: z.ZodType<CheckedComponent> = z.lazy(() =>
  looseObject({
    definitionPath: componentDefinitionPath,
    componentPath,
    args: z.record(identifier, resource),
    childComponents: z.record(identifier, checkedComponent),
    httpRoutes: checkedHttpRoutes,
    exports: z.record(identifier, checkedExport),
  }),
);
