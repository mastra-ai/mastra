"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var components_exports = {};
__export(components_exports, {
  componentsGeneric: () => componentsGeneric,
  createFunctionHandle: () => createFunctionHandle,
  currentSystemUdfInComponent: () => currentSystemUdfInComponent,
  defineApp: () => defineApp,
  defineComponent: () => defineComponent,
  getFunctionAddress: () => import_paths2.getFunctionAddress
});
module.exports = __toCommonJS(components_exports);
var import_values = require("../../values/index.js");
var import__ = require("../../index.js");
var import_syscall = require("../impl/syscall.js");
var import_paths = require("./paths.js");
var import_paths2 = require("./paths.js");
async function createFunctionHandle(functionReference) {
  const address = (0, import_paths.getFunctionAddress)(functionReference);
  return await (0, import_syscall.performAsyncSyscall)("1.0/createFunctionHandle", {
    ...address,
    version: import__.version
  });
}
class InstalledComponent {
  constructor(definition, name) {
    /**
     * @internal
     */
    __publicField(this, "_definition");
    /**
     * @internal
     */
    __publicField(this, "_name");
    this._definition = definition;
    this._name = name;
    (0, import_paths.setReferencePath)(this, `_reference/childComponent/${name}`);
  }
  get exports() {
    return createExports(this._name, []);
  }
}
function createExports(name, pathParts) {
  const handler = {
    get(_, prop) {
      if (typeof prop === "string") {
        const newParts = [...pathParts, prop];
        return createExports(name, newParts);
      } else if (prop === import_paths.toReferencePath) {
        let reference = `_reference/childComponent/${name}`;
        for (const part of pathParts) {
          reference += `/${part}`;
        }
        return reference;
      } else {
        return void 0;
      }
    }
  };
  return new Proxy({}, handler);
}
function use(definition, options) {
  const importedComponentDefinition = definition;
  if (typeof importedComponentDefinition.componentDefinitionPath !== "string") {
    throw new Error(
      "Component definition does not have the required componentDefinitionPath property. This code only works in Convex runtime."
    );
  }
  const name = options?.name || // added recently
  importedComponentDefinition.defaultName || // can be removed once backend is out
  importedComponentDefinition.componentDefinitionPath.split("/").pop();
  this._childComponents.push([name, importedComponentDefinition, {}]);
  return new InstalledComponent(definition, name);
}
function exportAppForAnalysis() {
  const definitionType = { type: "app" };
  const childComponents = serializeChildComponents(this._childComponents);
  return {
    definitionType,
    childComponents,
    httpMounts: {},
    exports: serializeExportTree(this._exportTree)
  };
}
function serializeExportTree(tree) {
  const branch = [];
  for (const [key, child] of Object.entries(tree)) {
    let node;
    if (typeof child === "string") {
      node = { type: "leaf", leaf: child };
    } else {
      node = serializeExportTree(child);
    }
    branch.push([key, node]);
  }
  return { type: "branch", branch };
}
function serializeChildComponents(childComponents) {
  return childComponents.map(([name, definition, p]) => {
    let args = null;
    if (p !== null) {
      args = [];
      for (const [name2, value] of Object.entries(p)) {
        if (value !== void 0) {
          args.push([
            name2,
            { type: "value", value: JSON.stringify((0, import_values.convexToJson)(value)) }
          ]);
        }
      }
    }
    const path = definition.componentDefinitionPath;
    if (!path)
      throw new Error(
        "no .componentPath for component definition " + JSON.stringify(definition, null, 2)
      );
    return {
      name,
      path,
      args
    };
  });
}
function exportComponentForAnalysis() {
  const args = Object.entries(
    this._args
  ).map(([name, validator]) => [
    name,
    {
      type: "value",
      value: JSON.stringify(validator.json)
    }
  ]);
  const definitionType = {
    type: "childComponent",
    name: this._name,
    args
  };
  const childComponents = serializeChildComponents(this._childComponents);
  return {
    name: this._name,
    definitionType,
    childComponents,
    httpMounts: {},
    exports: serializeExportTree(this._exportTree)
  };
}
function defineComponent(name) {
  const ret = {
    _isRoot: false,
    _name: name,
    _args: {},
    _childComponents: [],
    _exportTree: {},
    _onInitCallbacks: {},
    export: exportComponentForAnalysis,
    use,
    // pretend to conform to ComponentDefinition, which temporarily expects __args
    ...{}
  };
  return ret;
}
function defineApp() {
  const ret = {
    _isRoot: true,
    _childComponents: [],
    _exportTree: {},
    export: exportAppForAnalysis,
    use
  };
  return ret;
}
function currentSystemUdfInComponent(componentId) {
  return {
    [import_paths.toReferencePath]: `_reference/currentSystemUdfInComponent/${componentId}`
  };
}
function createChildComponents(root, pathParts) {
  const handler = {
    get(_, prop) {
      if (typeof prop === "string") {
        const newParts = [...pathParts, prop];
        return createChildComponents(root, newParts);
      } else if (prop === import_paths.toReferencePath) {
        if (pathParts.length < 1) {
          const found = [root, ...pathParts].join(".");
          throw new Error(
            `API path is expected to be of the form \`${root}.childComponent.functionName\`. Found: \`${found}\``
          );
        }
        return `_reference/childComponent/` + pathParts.join("/");
      } else {
        return void 0;
      }
    }
  };
  return new Proxy({}, handler);
}
const componentsGeneric = () => createChildComponents("components", []);
//# sourceMappingURL=index.js.map
