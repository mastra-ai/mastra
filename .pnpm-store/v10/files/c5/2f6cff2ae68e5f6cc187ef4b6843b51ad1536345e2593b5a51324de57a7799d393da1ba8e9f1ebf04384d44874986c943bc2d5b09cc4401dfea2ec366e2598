import { GenericDataModel } from "../data_model.js";
import { ActionBuilder, GenericActionCtx, MutationBuilder, PublicHttpAction, QueryBuilder } from "../registration.js";
export declare function validateReturnValue(v: any): void;
export declare function invokeFunction<Ctx, Args extends any[], F extends (ctx: Ctx, ...args: Args) => any>(func: F, ctx: Ctx, args: Args): Promise<any>;
/**
 * Define a mutation in this Convex app's public API.
 *
 * This function will be allowed to modify your Convex database and will be accessible from the client.
 *
 * If you're using code generation, use the `mutation` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The mutation function. It receives a {@link GenericMutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export declare const mutationGeneric: MutationBuilder<any, "public">;
/**
 * Define a mutation that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to modify your Convex database. It will not be accessible from the client.
 *
 * If you're using code generation, use the `internalMutation` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The mutation function. It receives a {@link GenericMutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export declare const internalMutationGeneric: MutationBuilder<any, "internal">;
/**
 * Define a query in this Convex app's public API.
 *
 * This function will be allowed to read your Convex database and will be accessible from the client.
 *
 * If you're using code generation, use the `query` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The query function. It receives a {@link GenericQueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export declare const queryGeneric: QueryBuilder<any, "public">;
/**
 * Define a query that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to read from your Convex database. It will not be accessible from the client.
 *
 * If you're using code generation, use the `internalQuery` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The query function. It receives a {@link GenericQueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export declare const internalQueryGeneric: QueryBuilder<any, "internal">;
/**
 * Define an action in this Convex app's public API.
 *
 * If you're using code generation, use the `action` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The function. It receives a {@link GenericActionCtx} as its first argument.
 * @returns The wrapped function. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export declare const actionGeneric: ActionBuilder<any, "public">;
/**
 * Define an action that is only accessible from other Convex functions (but not from the client).
 *
 * If you're using code generation, use the `internalAction` function in
 * `convex/_generated/server.d.ts` which is typed for your data model.
 *
 * @param func - The function. It receives a {@link GenericActionCtx} as its first argument.
 * @returns The wrapped function. Include this as an `export` to name it and make it accessible.
 *
 * @public
 */
export declare const internalActionGeneric: ActionBuilder<any, "internal">;
/**
 * Define a Convex HTTP action.
 *
 * @param func - The function. It receives an {@link GenericActionCtx} as its first argument, and a `Request` object
 * as its second.
 * @returns The wrapped function. Route a URL path to this function in `convex/http.js`.
 *
 * @public
 */
export declare const httpActionGeneric: (func: (ctx: GenericActionCtx<GenericDataModel>, request: Request) => Promise<Response>) => PublicHttpAction;
//# sourceMappingURL=registration_impl.d.ts.map