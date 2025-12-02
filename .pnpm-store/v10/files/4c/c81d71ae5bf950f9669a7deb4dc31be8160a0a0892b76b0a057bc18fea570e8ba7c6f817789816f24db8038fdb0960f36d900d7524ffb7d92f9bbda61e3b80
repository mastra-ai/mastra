import { z } from "zod";
import { looseObject } from "./utils.js";

// TODO share some of these types, to distinguish between encodedComponentDefinitionPaths etc.
export const componentDefinitionPath = z.string();
export type ComponentDefinitionPath = z.infer<typeof componentDefinitionPath>;

export const componentPath = z.string();
export type ComponentPath = z.infer<typeof componentPath>;

export const canonicalizedModulePath = z.string();
export type CanonicalizedModulePath = z.infer<typeof canonicalizedModulePath>;

export const componentFunctionPath = looseObject({
  component: z.string(),
  udfPath: z.string(),
});
export type ComponentFunctionPath = z.infer<typeof componentFunctionPath>;
