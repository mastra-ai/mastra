import { PropertyValidators, convexToJson } from "../../values/index.js";
import { version } from "../../index.js";
import {
  AnyFunctionReference,
  FunctionReference,
  FunctionType,
} from "../api.js";
import { performAsyncSyscall } from "../impl/syscall.js";
import { DefaultFunctionArgs } from "../registration.js";
import {
  AppDefinitionAnalysis,
  ComponentDefinitionAnalysis,
  ComponentDefinitionType,
} from "./definition.js";
import {
  getFunctionAddress,
  setReferencePath,
  toReferencePath,
} from "./paths.js";
export { getFunctionAddress } from "./paths.js";

/**
 * A serializable reference to a Convex function.
 * Passing a this reference to another component allows that component to call this
 * function during the current function execution or at any later time.
 * Function handles are used like `api.folder.function` FunctionReferences,
 * e.g. `ctx.scheduler.runAfter(0, functionReference, args)`.
 *
 * A function reference is stable across code pushes but it's possible
 * the Convex function it refers to might no longer exist.
 *
 * This is a feature of components, which are in beta.
 * This API is unstable and may change in subsequent releases.
 */
export type FunctionHandle<
  Type extends FunctionType,
  Args extends DefaultFunctionArgs = any,
  ReturnType = any,
> = string & FunctionReference<Type, "internal", Args, ReturnType>;

/**
 * Create a serializable reference to a Convex function.
 * Passing a this reference to another component allows that component to call this
 * function during the current function execution or at any later time.
 * Function handles are used like `api.folder.function` FunctionReferences,
 * e.g. `ctx.scheduler.runAfter(0, functionReference, args)`.
 *
 * A function reference is stable across code pushes but it's possible
 * the Convex function it refers to might no longer exist.
 *
 * This is a feature of components, which are in beta.
 * This API is unstable and may change in subsequent releases.
 */
export async function createFunctionHandle<
  Type extends FunctionType,
  Args extends DefaultFunctionArgs,
  ReturnType,
>(
  functionReference: FunctionReference<
    Type,
    "public" | "internal",
    Args,
    ReturnType
  >,
): Promise<FunctionHandle<Type, Args, ReturnType>> {
  const address = getFunctionAddress(functionReference);
  return await performAsyncSyscall("1.0/createFunctionHandle", {
    ...address,
    version,
  });
}

interface ComponentExports {
  [key: string]: FunctionReference<any, any, any, any> | ComponentExports;
}

/**
 * An object of this type should be the default export of a
 * convex.config.ts file in a component definition directory.
 *
 * This is a feature of components, which are in beta.
 * This API is unstable and may change in subsequent releases.
 */
export type ComponentDefinition<Exports extends ComponentExports = any> = {
  /**
   * Install a component with the given definition in this component definition.
   *
   * Takes a component definition and an optional name.
   *
   * For editor tooling this method expects a {@link ComponentDefinition}
   * but at runtime the object that is imported will be a {@link ImportedComponentDefinition}
   */
  use<Definition extends ComponentDefinition<any>>(
    definition: Definition,
    options?: {
      name?: string;
    },
  ): InstalledComponent<Definition>;

  /**
   * Internal type-only property tracking exports provided.
   *
   * @deprecated This is a type-only property, don't use it.
   */
  __exports: Exports;
};

type ComponentDefinitionExports<T extends ComponentDefinition<any>> =
  T["__exports"];

/**
 * An object of this type should be the default export of a
 * convex.config.ts file in a component-aware convex directory.
 *
 * This is a feature of components, which are in beta.
 * This API is unstable and may change in subsequent releases.
 */
export type AppDefinition = {
  /**
   * Install a component with the given definition in this component definition.
   *
   * Takes a component definition and an optional name.
   *
   * For editor tooling this method expects a {@link ComponentDefinition}
   * but at runtime the object that is imported will be a {@link ImportedComponentDefinition}
   */
  use<Definition extends ComponentDefinition<any>>(
    definition: Definition,
    options?: {
      name?: string;
    },
  ): InstalledComponent<Definition>;
};

interface ExportTree {
  // Tree with serialized `Reference`s as leaves.
  [key: string]: string | ExportTree;
}

type CommonDefinitionData = {
  _isRoot: boolean;
  _childComponents: [
    string,
    ImportedComponentDefinition,
    Record<string, any> | null,
  ][];
  _exportTree: ExportTree;
};

type ComponentDefinitionData = CommonDefinitionData & {
  _args: PropertyValidators;
  _name: string;
  _onInitCallbacks: Record<string, (argsStr: string) => string>;
};
type AppDefinitionData = CommonDefinitionData;

/**
 * Used to refer to an already-installed component.
 */
class InstalledComponent<Definition extends ComponentDefinition<any>> {
  /**
   * @internal
   */
  _definition: Definition;

  /**
   * @internal
   */
  _name: string;

  constructor(definition: Definition, name: string) {
    this._definition = definition;
    this._name = name;
    setReferencePath(this, `_reference/childComponent/${name}`);
  }

  get exports(): ComponentDefinitionExports<Definition> {
    return createExports(this._name, []);
  }
}

function createExports(name: string, pathParts: string[]): any {
  const handler: ProxyHandler<any> = {
    get(_, prop: string | symbol) {
      if (typeof prop === "string") {
        const newParts = [...pathParts, prop];
        return createExports(name, newParts);
      } else if (prop === toReferencePath) {
        let reference = `_reference/childComponent/${name}`;
        for (const part of pathParts) {
          reference += `/${part}`;
        }
        return reference;
      } else {
        return undefined;
      }
    },
  };
  return new Proxy({}, handler);
}

function use<Definition extends ComponentDefinition<any>>(
  this: CommonDefinitionData,
  definition: Definition,
  options?: {
    name?: string;
  },
): InstalledComponent<Definition> {
  // At runtime an imported component will have this shape.
  const importedComponentDefinition =
    definition as unknown as ImportedComponentDefinition;
  if (typeof importedComponentDefinition.componentDefinitionPath !== "string") {
    throw new Error(
      "Component definition does not have the required componentDefinitionPath property. This code only works in Convex runtime.",
    );
  }
  const name =
    options?.name ||
    // added recently
    importedComponentDefinition.defaultName ||
    // can be removed once backend is out
    importedComponentDefinition.componentDefinitionPath.split("/").pop()!;
  this._childComponents.push([name, importedComponentDefinition, {}]);
  return new InstalledComponent(definition, name);
}

/**
 * The runtime type of a ComponentDefinition. TypeScript will claim
 * the default export of a module like "cool-component/convex.config.js"
 * is a `@link ComponentDefinition}, but during component definition evaluation
 * this is its type instead.
 *
 * This is a feature of components, which are in beta.
 * This API is unstable and may change in subsequent releases.
 */
export type ImportedComponentDefinition = {
  componentDefinitionPath: string;
  defaultName: string;
};

function exportAppForAnalysis(
  this: ComponentDefinition<any> & AppDefinitionData,
): AppDefinitionAnalysis {
  const definitionType = { type: "app" as const };
  const childComponents = serializeChildComponents(this._childComponents);
  return {
    definitionType,
    childComponents: childComponents as any,
    httpMounts: {},
    exports: serializeExportTree(this._exportTree),
  };
}

function serializeExportTree(tree: ExportTree): any {
  const branch: any[] = [];
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

function serializeChildComponents(
  childComponents: [
    string,
    ImportedComponentDefinition,
    Record<string, any> | null,
  ][],
): {
  name: string;
  path: string;
  args: [string, { type: "value"; value: string }][] | null;
}[] {
  return childComponents.map(([name, definition, p]) => {
    let args: [string, { type: "value"; value: string }][] | null = null;
    if (p !== null) {
      args = [];
      for (const [name, value] of Object.entries(p)) {
        if (value !== undefined) {
          args.push([
            name,
            { type: "value", value: JSON.stringify(convexToJson(value)) },
          ]);
        }
      }
    }
    // we know that components carry this extra information
    const path = definition.componentDefinitionPath;
    if (!path)
      throw new Error(
        "no .componentPath for component definition " +
          JSON.stringify(definition, null, 2),
      );

    return {
      name: name!,
      path: path!,
      args,
    };
  });
}

function exportComponentForAnalysis(
  this: ComponentDefinition<any> & ComponentDefinitionData,
): ComponentDefinitionAnalysis {
  const args: [string, { type: "value"; value: string }][] = Object.entries(
    this._args,
  ).map(([name, validator]) => [
    name,
    {
      type: "value",
      value: JSON.stringify(validator.json),
    },
  ]);
  const definitionType: ComponentDefinitionType = {
    type: "childComponent" as const,
    name: this._name,
    args,
  };
  const childComponents = serializeChildComponents(this._childComponents);
  return {
    name: this._name,
    definitionType,
    childComponents: childComponents as any,
    httpMounts: {},
    exports: serializeExportTree(this._exportTree),
  };
}

// This is what is actually contained in a ComponentDefinition.
type RuntimeComponentDefinition = Omit<ComponentDefinition<any>, "__exports"> &
  ComponentDefinitionData & {
    export: () => ComponentDefinitionAnalysis;
  };
type RuntimeAppDefinition = AppDefinition &
  AppDefinitionData & {
    export: () => AppDefinitionAnalysis;
  };

/**
 * Define a component, a piece of a Convex deployment with namespaced resources.
 *
 * The default
 * the default export of a module like "cool-component/convex.config.js"
 * is a `@link ComponentDefinition}, but during component definition evaluation
 * this is its type instead.
 *
 * @param name Name must be alphanumeric plus underscores. Typically these are
 * lowercase with underscores like `"onboarding_flow_tracker"`.
 *
 * This is a feature of components, which are in beta.
 * This API is unstable and may change in subsequent releases.
 */
export function defineComponent<Exports extends ComponentExports = any>(
  name: string,
): ComponentDefinition<Exports> {
  const ret: RuntimeComponentDefinition = {
    _isRoot: false,
    _name: name,
    _args: {},
    _childComponents: [],
    _exportTree: {},
    _onInitCallbacks: {},

    export: exportComponentForAnalysis,
    use,

    // pretend to conform to ComponentDefinition, which temporarily expects __args
    ...({} as { __args: any; __exports: any }),
  };
  return ret as any as ComponentDefinition<Exports>;
}

/**
 * Attach components, reuseable pieces of a Convex deployment, to this Convex app.
 *
 * This is a feature of components, which are in beta.
 * This API is unstable and may change in subsequent releases.
 */
export function defineApp(): AppDefinition {
  const ret: RuntimeAppDefinition = {
    _isRoot: true,
    _childComponents: [],
    _exportTree: {},

    export: exportAppForAnalysis,
    use,
  };
  return ret as AppDefinition;
}

type AnyInterfaceType = {
  [key: string]: AnyInterfaceType;
} & AnyFunctionReference;
export type AnyComponentReference = Record<string, AnyInterfaceType>;

export type AnyChildComponents = Record<string, AnyComponentReference>;

/**
 * @internal
 */
export function currentSystemUdfInComponent(
  componentId: string,
): AnyComponentReference {
  return {
    [toReferencePath]: `_reference/currentSystemUdfInComponent/${componentId}`,
  };
}

function createChildComponents(
  root: string,
  pathParts: string[],
): AnyChildComponents {
  const handler: ProxyHandler<object> = {
    get(_, prop: string | symbol) {
      if (typeof prop === "string") {
        const newParts = [...pathParts, prop];
        return createChildComponents(root, newParts);
      } else if (prop === toReferencePath) {
        if (pathParts.length < 1) {
          const found = [root, ...pathParts].join(".");
          throw new Error(
            `API path is expected to be of the form \`${root}.childComponent.functionName\`. Found: \`${found}\``,
          );
        }
        return `_reference/childComponent/` + pathParts.join("/");
      } else {
        return undefined;
      }
    },
  };
  return new Proxy({}, handler);
}

export const componentsGeneric = () => createChildComponents("components", []);

export type AnyComponents = AnyChildComponents;
