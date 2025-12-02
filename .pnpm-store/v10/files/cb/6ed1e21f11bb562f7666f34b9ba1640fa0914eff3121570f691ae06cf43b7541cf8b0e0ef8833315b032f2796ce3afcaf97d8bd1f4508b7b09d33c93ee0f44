import {
  EmptyObject,
  DefaultFunctionArgs,
  FunctionVisibility,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
} from "./registration.js";
import { Expand, UnionToIntersection } from "../type_utils.js";
import { PaginationOptions, PaginationResult } from "./pagination.js";
import { functionName } from "./functionName.js";
import { getFunctionAddress } from "./components/paths.js";

/**
 * The type of a Convex function.
 *
 * @public
 */
export type FunctionType = "query" | "mutation" | "action";

/**
 * A reference to a registered Convex function.
 *
 * You can create a {@link FunctionReference} using the generated `api` utility:
 * ```js
 * import { api } from "../convex/_generated/api";
 *
 * const reference = api.myModule.myFunction;
 * ```
 *
 * If you aren't using code generation, you can create references using
 * {@link anyApi}:
 * ```js
 * import { anyApi } from "convex/server";
 *
 * const reference = anyApi.myModule.myFunction;
 * ```
 *
 * Function references can be used to invoke functions from the client. For
 * example, in React you can pass references to the {@link react.useQuery} hook:
 * ```js
 * const result = useQuery(api.myModule.myFunction);
 * ```
 *
 * @typeParam Type - The type of the function ("query", "mutation", or "action").
 * @typeParam Visibility - The visibility of the function ("public" or "internal").
 * @typeParam Args - The arguments to this function. This is an object mapping
 * argument names to their types.
 * @typeParam ReturnType - The return type of this function.
 * @public
 */
export type FunctionReference<
  Type extends FunctionType,
  Visibility extends FunctionVisibility = "public",
  Args extends DefaultFunctionArgs = any,
  ReturnType = any,
  ComponentPath = string | undefined,
> = {
  _type: Type;
  _visibility: Visibility;
  _args: Args;
  _returnType: ReturnType;
  _componentPath: ComponentPath;
};

/**
 * Get the name of a function from a {@link FunctionReference}.
 *
 * The name is a string like "myDir/myModule:myFunction". If the exported name
 * of the function is `"default"`, the function name is omitted
 * (e.g. "myDir/myModule").
 *
 * @param functionReference - A {@link FunctionReference} to get the name of.
 * @returns A string of the function's name.
 *
 * @public
 */
export function getFunctionName(
  functionReference: AnyFunctionReference,
): string {
  const address = getFunctionAddress(functionReference);

  if (address.name === undefined) {
    if (address.functionHandle !== undefined) {
      throw new Error(
        `Expected function reference like "api.file.func" or "internal.file.func", but received function handle ${address.functionHandle}`,
      );
    } else if (address.reference !== undefined) {
      throw new Error(
        `Expected function reference in the current component like "api.file.func" or "internal.file.func", but received reference ${address.reference}`,
      );
    }
    throw new Error(
      `Expected function reference like "api.file.func" or "internal.file.func", but received ${JSON.stringify(address)}`,
    );
  }
  // Both a legacy thing and also a convenience for interactive use:
  // the types won't check but a string is always allowed at runtime.
  if (typeof functionReference === "string") return functionReference;

  // Two different runtime values for FunctionReference implement this
  // interface: api objects returned from `createApi()` and standalone
  // function reference objects returned from makeFunctionReference.
  const name = (functionReference as any)[functionName];
  if (!name) {
    throw new Error(`${functionReference as any} is not a functionReference`);
  }
  return name;
}

/**
 * FunctionReferences generally come from generated code, but in custom clients
 * it may be useful to be able to build one manually.
 *
 * Real function references are empty objects at runtime, but the same interface
 * can be implemented with an object for tests and clients which don't use
 * code generation.
 *
 * @param name - The identifier of the function. E.g. `path/to/file:functionName`
 * @public
 */
export function makeFunctionReference<
  type extends FunctionType,
  args extends DefaultFunctionArgs = any,
  ret = any,
>(name: string): FunctionReference<type, "public", args, ret> {
  return { [functionName]: name } as unknown as FunctionReference<
    type,
    "public",
    args,
    ret
  >;
}

/**
 * Create a runtime API object that implements {@link AnyApi}.
 *
 * This allows accessing any path regardless of what directories, modules,
 * or functions are defined.
 *
 * @param pathParts - The path to the current node in the API.
 * @returns An {@link AnyApi}
 * @public
 */
function createApi(pathParts: string[] = []): AnyApi {
  const handler: ProxyHandler<object> = {
    get(_, prop: string | symbol) {
      if (typeof prop === "string") {
        const newParts = [...pathParts, prop];
        return createApi(newParts);
      } else if (prop === functionName) {
        if (pathParts.length < 2) {
          const found = ["api", ...pathParts].join(".");
          throw new Error(
            `API path is expected to be of the form \`api.moduleName.functionName\`. Found: \`${found}\``,
          );
        }
        const path = pathParts.slice(0, -1).join("/");
        const exportName = pathParts[pathParts.length - 1];
        if (exportName === "default") {
          return path;
        } else {
          return path + ":" + exportName;
        }
      } else if (prop === Symbol.toStringTag) {
        return "FunctionReference";
      } else {
        return undefined;
      }
    },
  };

  return new Proxy({}, handler);
}

/**
 * Given an export from a module, convert it to a {@link FunctionReference}
 * if it is a Convex function.
 */
export type FunctionReferenceFromExport<Export> =
  Export extends RegisteredQuery<
    infer Visibility,
    infer Args,
    infer ReturnValue
  >
    ? FunctionReference<
        "query",
        Visibility,
        Args,
        ConvertReturnType<ReturnValue>
      >
    : Export extends RegisteredMutation<
          infer Visibility,
          infer Args,
          infer ReturnValue
        >
      ? FunctionReference<
          "mutation",
          Visibility,
          Args,
          ConvertReturnType<ReturnValue>
        >
      : Export extends RegisteredAction<
            infer Visibility,
            infer Args,
            infer ReturnValue
          >
        ? FunctionReference<
            "action",
            Visibility,
            Args,
            ConvertReturnType<ReturnValue>
          >
        : never;

/**
 * Given a module, convert all the Convex functions into
 * {@link FunctionReference}s and remove the other exports.
 *
 * BE CAREFUL WHEN EDITING THIS!
 *
 * This is written carefully to preserve jumping to function definitions using
 * cmd+click. If you edit it, please test that cmd+click still works.
 */
type FunctionReferencesInModule<Module extends Record<string, any>> = {
  -readonly [ExportName in keyof Module as Module[ExportName]["isConvexFunction"] extends true
    ? ExportName
    : never]: FunctionReferenceFromExport<Module[ExportName]>;
};

/**
 * Given a path to a module and it's type, generate an API type for this module.
 *
 * This is a nested object according to the module's path.
 */
type ApiForModule<
  ModulePath extends string,
  Module extends object,
> = ModulePath extends `${infer First}/${infer Second}`
  ? {
      [_ in First]: ApiForModule<Second, Module>;
    }
  : { [_ in ModulePath]: FunctionReferencesInModule<Module> };

/**
 * Given the types of all modules in the `convex/` directory, construct the type
 * of `api`.
 *
 * `api` is a utility for constructing {@link FunctionReference}s.
 *
 * @typeParam AllModules - A type mapping module paths (like `"dir/myModule"`) to
 * the types of the modules.
 * @public
 */
export type ApiFromModules<AllModules extends Record<string, object>> =
  FilterApi<
    ApiFromModulesAllowEmptyNodes<AllModules>,
    FunctionReference<any, any, any, any>
  >;

type ApiFromModulesAllowEmptyNodes<AllModules extends Record<string, object>> =
  ExpandModulesAndDirs<
    UnionToIntersection<
      {
        [ModulePath in keyof AllModules]: ApiForModule<
          ModulePath & string,
          AllModules[ModulePath]
        >;
      }[keyof AllModules]
    >
  >;

/**
 * @public
 *
 * Filter a Convex deployment api object for functions which meet criteria,
 * for example all public queries.
 */
export type FilterApi<API, Predicate> = Expand<{
  [mod in keyof API as API[mod] extends Predicate
    ? mod
    : API[mod] extends FunctionReference<any, any, any, any>
      ? never
      : FilterApi<API[mod], Predicate> extends Record<string, never>
        ? never
        : mod]: API[mod] extends Predicate
    ? API[mod]
    : FilterApi<API[mod], Predicate>;
}>;

/**
 * Given an api of type API and a FunctionReference subtype, return an api object
 * containing only the function references that match.
 *
 * ```ts
 * const q = filterApi<typeof api, FunctionReference<"query">>(api)
 * ```
 *
 * @public
 */
export function filterApi<API, Predicate>(api: API): FilterApi<API, Predicate> {
  return api as any;
}

// These just* API filter helpers require no type parameters so are useable from JavaScript.
/** @public */
export function justInternal<API>(
  api: API,
): FilterApi<API, FunctionReference<any, "internal", any, any>> {
  return api as any;
}

/** @public */
export function justPublic<API>(
  api: API,
): FilterApi<API, FunctionReference<any, "public", any, any>> {
  return api as any;
}

/** @public */
export function justQueries<API>(
  api: API,
): FilterApi<API, FunctionReference<"query", any, any, any>> {
  return api as any;
}

/** @public */
export function justMutations<API>(
  api: API,
): FilterApi<API, FunctionReference<"mutation", any, any, any>> {
  return api as any;
}

/** @public */
export function justActions<API>(
  api: API,
): FilterApi<API, FunctionReference<"action", any, any, any>> {
  return api as any;
}

/** @public */
export function justPaginatedQueries<API>(
  api: API,
): FilterApi<
  API,
  FunctionReference<
    "query",
    any,
    { paginationOpts: PaginationOptions },
    PaginationResult<any>
  >
> {
  return api as any;
}

/** @public */
export function justSchedulable<API>(
  api: API,
): FilterApi<API, FunctionReference<"mutation" | "action", any, any, any>> {
  return api as any;
}

/**
 * Like {@link Expand}, this simplifies how TypeScript displays object types.
 * The differences are:
 * 1. This version is recursive.
 * 2. This stops recursing when it hits a {@link FunctionReference}.
 */
type ExpandModulesAndDirs<ObjectType> = ObjectType extends AnyFunctionReference
  ? ObjectType
  : {
      [Key in keyof ObjectType]: ExpandModulesAndDirs<ObjectType[Key]>;
    };

/**
 * A {@link FunctionReference} of any type and any visibility with any
 * arguments and any return type.
 *
 * @public
 */
export type AnyFunctionReference = FunctionReference<any, any>;

type AnyModuleDirOrFunc = {
  [key: string]: AnyModuleDirOrFunc;
} & AnyFunctionReference;

/**
 * The type that Convex api objects extend. If you were writing an api from
 * scratch it should extend this type.
 *
 * @public
 */
export type AnyApi = Record<string, Record<string, AnyModuleDirOrFunc>>;

/**
 * Recursive partial API, useful for defining a subset of an API when mocking
 * or building custom api objects.
 *
 * @public
 */
export type PartialApi<API> = {
  [mod in keyof API]?: API[mod] extends FunctionReference<any, any, any, any>
    ? API[mod]
    : PartialApi<API[mod]>;
};

/**
 * A utility for constructing {@link FunctionReference}s in projects that
 * are not using code generation.
 *
 * You can create a reference to a function like:
 * ```js
 * const reference = anyApi.myModule.myFunction;
 * ```
 *
 * This supports accessing any path regardless of what directories and modules
 * are in your project. All function references are typed as
 * {@link AnyFunctionReference}.
 *
 *
 * If you're using code generation, use `api` from `convex/_generated/api`
 * instead. It will be more type-safe and produce better auto-complete
 * in your editor.
 *
 * @public
 */
export const anyApi: AnyApi = createApi() as any;

/**
 * Given a {@link FunctionReference}, get the return type of the function.
 *
 * This is represented as an object mapping argument names to values.
 * @public
 */
export type FunctionArgs<FuncRef extends AnyFunctionReference> =
  FuncRef["_args"];

/**
 * A tuple type of the (maybe optional) arguments to `FuncRef`.
 *
 * This type is used to make methods involving arguments type safe while allowing
 * skipping the arguments for functions that don't require arguments.
 *
 * @public
 */
export type OptionalRestArgs<FuncRef extends AnyFunctionReference> =
  FuncRef["_args"] extends EmptyObject
    ? [args?: EmptyObject]
    : [args: FuncRef["_args"]];

/**
 * A tuple type of the (maybe optional) arguments to `FuncRef`, followed by an options
 * object of type `Options`.
 *
 * This type is used to make methods like `useQuery` type-safe while allowing
 * 1. Skipping arguments for functions that don't require arguments.
 * 2. Skipping the options object.
 * @public
 */
export type ArgsAndOptions<
  FuncRef extends AnyFunctionReference,
  Options,
> = FuncRef["_args"] extends EmptyObject
  ? [args?: EmptyObject, options?: Options]
  : [args: FuncRef["_args"], options?: Options];

/**
 * Given a {@link FunctionReference}, get the return type of the function.
 *
 * @public
 */
export type FunctionReturnType<FuncRef extends AnyFunctionReference> =
  FuncRef["_returnType"];

type UndefinedToNull<T> = T extends void ? null : T;

type NullToUndefinedOrNull<T> = T extends null ? T | undefined | void : T;

/**
 * Convert the return type of a function to it's client-facing format.
 *
 * This means:
 * - Converting `undefined` and `void` to `null`
 * - Removing all `Promise` wrappers
 */
export type ConvertReturnType<T> = UndefinedToNull<Awaited<T>>;

export type ValidatorTypeToReturnType<T> =
  | Promise<NullToUndefinedOrNull<T>>
  | NullToUndefinedOrNull<T>;
