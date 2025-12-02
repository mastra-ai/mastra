import { S as ProxifiedObject, b as ProxifiedModule, c as Proxified, p as ProxifiedFunctionCall } from "../types-CQa2aD_O.js";
import { VariableDeclarator } from "@babel/types";

//#region src/helpers/deep-merge.d.ts
declare function deepMergeObject(magicast: Proxified<any>, object: any): void;
//#endregion
//#region src/helpers/nuxt.d.ts
declare function addNuxtModule(magicast: ProxifiedModule<any>, name: string, optionsKey?: string, options?: any): void;
//#endregion
//#region src/helpers/vite.d.ts
interface AddVitePluginOptions {
  /**
   * The import path of the plugin
   */
  from: string;
  /**
   * The import name of the plugin
   * @default "default"
   */
  imported?: string;
  /**
   * The name of local variable
   */
  constructor: string;
  /**
   * The options of the plugin
   */
  options?: Record<string, any>;
  /**
   * The index in the plugins array where the plugin should be inserted at.
   * By default, the plugin is appended to the array.
   */
  index?: number;
}
interface UpdateVitePluginConfigOptions {
  /**
   * The import path of the plugin
   */
  from: string;
  /**
   * The import name of the plugin
   * @default "default"
   */
  imported?: string;
}
declare function addVitePlugin(magicast: ProxifiedModule<any>, plugin: AddVitePluginOptions): boolean;
declare function findVitePluginCall(magicast: ProxifiedModule<any>, plugin: UpdateVitePluginConfigOptions | string): ProxifiedFunctionCall | undefined;
declare function updateVitePluginConfig(magicast: ProxifiedModule<any>, plugin: UpdateVitePluginConfigOptions | string, handler: Record<string, any> | ((args: any[]) => any[])): boolean;
//#endregion
//#region src/helpers/config.d.ts
declare function getDefaultExportOptions(magicast: ProxifiedModule<any>): ProxifiedObject<any>;
/**
 * Returns the vite config object from a variable declaration thats
 * exported as the default export.
 *
 * Example:
 *
 * ```js
 * const config = {};
 * export default config;
 * ```
 *
 * @param magicast the module
 *
 * @returns an object containing the proxified config object and the
 *          declaration "parent" to attach the modified config to later.
 *          If no config declaration is found, undefined is returned.
 */
declare function getConfigFromVariableDeclaration(magicast: ProxifiedModule<any>): {
  declaration: VariableDeclarator;
  config: ProxifiedObject<any> | undefined;
};
//#endregion
export { AddVitePluginOptions, UpdateVitePluginConfigOptions, addNuxtModule, addVitePlugin, deepMergeObject, findVitePluginCall, getConfigFromVariableDeclaration, getDefaultExportOptions, updateVitePluginConfig };