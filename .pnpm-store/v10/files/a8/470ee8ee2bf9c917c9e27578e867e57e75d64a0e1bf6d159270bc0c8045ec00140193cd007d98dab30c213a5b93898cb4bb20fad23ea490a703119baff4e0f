import { AnyFunctionReference, FunctionReference, FunctionType } from "../api.js";
import { DefaultFunctionArgs } from "../registration.js";
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
export type FunctionHandle<Type extends FunctionType, Args extends DefaultFunctionArgs = any, ReturnType = any> = string & FunctionReference<Type, "internal", Args, ReturnType>;
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
export declare function createFunctionHandle<Type extends FunctionType, Args extends DefaultFunctionArgs, ReturnType>(functionReference: FunctionReference<Type, "public" | "internal", Args, ReturnType>): Promise<FunctionHandle<Type, Args, ReturnType>>;
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
    use<Definition extends ComponentDefinition<any>>(definition: Definition, options?: {
        name?: string;
    }): InstalledComponent<Definition>;
    /**
     * Internal type-only property tracking exports provided.
     *
     * @deprecated This is a type-only property, don't use it.
     */
    __exports: Exports;
};
type ComponentDefinitionExports<T extends ComponentDefinition<any>> = T["__exports"];
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
    use<Definition extends ComponentDefinition<any>>(definition: Definition, options?: {
        name?: string;
    }): InstalledComponent<Definition>;
};
/**
 * Used to refer to an already-installed component.
 */
declare class InstalledComponent<Definition extends ComponentDefinition<any>> {
    constructor(definition: Definition, name: string);
    get exports(): ComponentDefinitionExports<Definition>;
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
export declare function defineComponent<Exports extends ComponentExports = any>(name: string): ComponentDefinition<Exports>;
/**
 * Attach components, reuseable pieces of a Convex deployment, to this Convex app.
 *
 * This is a feature of components, which are in beta.
 * This API is unstable and may change in subsequent releases.
 */
export declare function defineApp(): AppDefinition;
type AnyInterfaceType = {
    [key: string]: AnyInterfaceType;
} & AnyFunctionReference;
export type AnyComponentReference = Record<string, AnyInterfaceType>;
export type AnyChildComponents = Record<string, AnyComponentReference>;
export declare const componentsGeneric: () => AnyChildComponents;
export type AnyComponents = AnyChildComponents;
//# sourceMappingURL=index.d.ts.map