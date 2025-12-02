declare type ModuleType = "esm" | "cjs";

/**
 * Information that discribes a module to be imported.
 */
declare type ModuleInfo = {
  /**
   * Global variable name with which the import statements of the module
   * should be replaced.
   */
  varName: string;

  /**
   * Type (either `"esm"` or `"cjs"`) that determines the internal behavior of
   * this plugin. Defaults to `"esm"`.
   */
  type?: ModuleType;

  /**
   * Names of variables that are exported from the module and may be imported
   * from another module.
   * No effect if `type` is `"cjs"`.
   */
  namedExports?: readonly string[];

  /**
   * Set to `false` to prevent emitting code for default import/export
   * (which you won't need to unless you are finicky).
   * Defaults to `true`. No effect if `type` is `"cjs"`.
   */
  defaultExport?: boolean;
};

declare const globalsModuleInfoMap: Required<Record<"react" | "react-dom" | "react-dom/client" | "@storybook/icons" | "storybook/manager-api" | "storybook/test" | "storybook/theming" | "storybook/theming/create" | "storybook/internal/channels" | "storybook/internal/client-logger" | "storybook/internal/components" | "storybook/internal/core-errors" | "storybook/internal/core-events" | "storybook/internal/manager-errors" | "storybook/internal/router" | "storybook/internal/types" | "storybook/internal/manager-api" | "storybook/internal/theming" | "storybook/internal/theming/create", Required<ModuleInfo>>>;

export { globalsModuleInfoMap };
