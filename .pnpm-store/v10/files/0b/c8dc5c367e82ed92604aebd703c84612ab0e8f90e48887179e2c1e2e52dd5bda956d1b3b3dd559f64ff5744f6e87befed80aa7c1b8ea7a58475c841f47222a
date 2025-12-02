import { header } from "./common.js";

export function componentServerTS(isRoot: boolean): string {
  const result = `
  ${header(
    "Generated utilities for implementing server-side Convex query and mutation functions.",
  )}
  import type {
    ActionBuilder,
    ${isRoot ? "AnyComponents," : ""}
    HttpActionBuilder,
    MutationBuilder,
    QueryBuilder,
    GenericActionCtx,
    GenericMutationCtx,
    GenericQueryCtx,
    GenericDatabaseReader,
    GenericDatabaseWriter,
  } from "convex/server";
  import {
    actionGeneric,
    httpActionGeneric,
    queryGeneric,
    mutationGeneric,
    internalActionGeneric,
    internalMutationGeneric,
    internalQueryGeneric,
    ${isRoot ? "componentsGeneric," : ""}
  } from "convex/server";
  import type { DataModel } from "./dataModel.js";

  /**
   * Define a query in this Convex app's public API.
   *
   * This function will be allowed to read your Convex database and will be accessible from the client.
   *
   * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
   * @returns The wrapped query. Include this as an \`export\` to name it and make it accessible.
   */
  export const query: QueryBuilder<DataModel, "public"> = queryGeneric;

  /**
   * Define a query that is only accessible from other Convex functions (but not from the client).
   *
   * This function will be allowed to read from your Convex database. It will not be accessible from the client.
   *
   * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
   * @returns The wrapped query. Include this as an \`export\` to name it and make it accessible.
   */
  export const internalQuery: QueryBuilder<DataModel, "internal"> = internalQueryGeneric;

  /**
   * Define a mutation in this Convex app's public API.
   *
   * This function will be allowed to modify your Convex database and will be accessible from the client.
   *
   * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
   * @returns The wrapped mutation. Include this as an \`export\` to name it and make it accessible.
   */
  export const mutation: MutationBuilder<DataModel, "public"> = mutationGeneric;

  /**
   * Define a mutation that is only accessible from other Convex functions (but not from the client).
   *
   * This function will be allowed to modify your Convex database. It will not be accessible from the client.
   *
   * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
   * @returns The wrapped mutation. Include this as an \`export\` to name it and make it accessible.
   */
  export const internalMutation: MutationBuilder<DataModel, "internal"> = internalMutationGeneric;

  /**
   * Define an action in this Convex app's public API.
   *
   * An action is a function which can execute any JavaScript code, including non-deterministic
   * code and code with side-effects, like calling third-party services.
   * They can be run in Convex's JavaScript environment or in Node.js using the "use node" directive.
   * They can interact with the database indirectly by calling queries and mutations using the {@link ActionCtx}.
   *
   * @param func - The action. It receives an {@link ActionCtx} as its first argument.
   * @returns The wrapped action. Include this as an \`export\` to name it and make it accessible.
   */
  export const action: ActionBuilder<DataModel, "public"> = actionGeneric;

  /**
   * Define an action that is only accessible from other Convex functions (but not from the client).
   *
   * @param func - The function. It receives an {@link ActionCtx} as its first argument.
   * @returns The wrapped function. Include this as an \`export\` to name it and make it accessible.
   */
  export const internalAction: ActionBuilder<DataModel, "internal"> = internalActionGeneric;

  /**
   * Define an HTTP action.
   *
   * The wrapped function will be used to respond to HTTP requests received
   * by a Convex deployment if the requests matches the path and method where
   * this action is routed. Be sure to route your httpAction in \`convex/http.js\`.
   *
   * @param func - The function. It receives an {@link ActionCtx} as its first argument
   * and a Fetch API \`Request\` object as its second.
   * @returns The wrapped function. Import this function from \`convex/http.js\` and route it to hook it up.
   */
  export const httpAction: HttpActionBuilder = httpActionGeneric;

  type GenericCtx = GenericActionCtx<DataModel> | GenericMutationCtx<DataModel> | GenericQueryCtx<DataModel>;

  /**
   * A set of services for use within Convex query functions.
   *
   * The query context is passed as the first argument to any Convex query
   * function run on the server.
   *
   * If you're using code generation, use the \`QueryCtx\` type in \`convex/_generated/server.d.ts\` instead.
   */
  export type QueryCtx = GenericQueryCtx<DataModel>;

  /**
   * A set of services for use within Convex mutation functions.
   *
   * The mutation context is passed as the first argument to any Convex mutation
   * function run on the server.
   *
   * If you're using code generation, use the \`MutationCtx\` type in \`convex/_generated/server.d.ts\` instead.
   */
  export type MutationCtx = GenericMutationCtx<DataModel>;

  /**
   * A set of services for use within Convex action functions.
   *
   * The action context is passed as the first argument to any Convex action
   * function run on the server.
   */
  export type ActionCtx = GenericActionCtx<DataModel>;

  /**
   * An interface to read from the database within Convex query functions.
   *
   * The two entry points are {@link DatabaseReader.get}, which fetches a single
   * document by its {@link Id}, or {@link DatabaseReader.query}, which starts
   * building a query.
   */
  export type DatabaseReader = GenericDatabaseReader<DataModel>;

  /**
   * An interface to read from and write to the database within Convex mutation
   * functions.
   *
   * Convex guarantees that all writes within a single mutation are
   * executed atomically, so you never have to worry about partial writes leaving
   * your data in an inconsistent state. See [the Convex Guide](https://docs.convex.dev/understanding/convex-fundamentals/functions#atomicity-and-optimistic-concurrency-control)
   * for the guarantees Convex provides your functions.
   */
  export type DatabaseWriter = GenericDatabaseWriter<DataModel>;
  ${
    isRoot
      ? `
  /**
   * Load the API for calling functions from this Convex deployment's components.
   */
  export const components: AnyComponents = componentsGeneric();`
      : ""
  }
  `;
  return result;
}
