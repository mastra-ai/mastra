import { z } from "zod";
import { componentDefinitionPath } from "./paths.js";
import { moduleConfig } from "./modules.js";
import { looseObject } from "./utils.js";

export const appDefinitionConfig = looseObject({
  definition: z.nullable(moduleConfig),
  dependencies: z.array(componentDefinitionPath),
  schema: z.nullable(moduleConfig),
  functions: z.array(moduleConfig),
  udfServerVersion: z.string(),
});
export type AppDefinitionConfig = z.infer<typeof appDefinitionConfig>;

export const componentDefinitionConfig = looseObject({
  definitionPath: componentDefinitionPath,
  definition: moduleConfig,
  dependencies: z.array(componentDefinitionPath),
  schema: z.nullable(moduleConfig),
  functions: z.array(moduleConfig),
  udfServerVersion: z.string(),
});
export type ComponentDefinitionConfig = z.infer<
  typeof componentDefinitionConfig
>;
