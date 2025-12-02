import { internalEvents } from "../helpers/consts.cjs";
import { IsEmptyObject, IsStringLiteral, Simplify } from "../helpers/types.cjs";
import { AnyZodObject, ValidZodValue, ZodInfer, ZodLiteral, ZodObject, ZodTypeAny } from "../helpers/validators/zod.cjs";
import { CancelledEventPayload, EventPayload, FailureEventPayload, FinishedEventPayload, InvokedEventPayload, ScheduledTimerEventPayload } from "../types.cjs";
import { StandardSchemaV1 } from "@standard-schema/spec";

//#region src/components/EventSchemas.d.ts

/**
 * Declares the shape of an event schema we expect from the user. This may be
 * different to what a user is sending us depending on the supported library,
 * but this normalized format is what we require as the end result.
 *
 * @internal
 */
type NormalizedEventSchema = {
  name?: string;
  data?: Record<string, any>;
  user?: Record<string, any>;
};
/**
 * A helper type that declares a normalized custom part of the event schema.
 *
 * @public
 */
type NormalizedEventSchemas = Record<string, NormalizedEventSchema>;
/**
 * Asserts that the given type `T` contains a mapping for all internal events.
 *
 * Usage of this ensures that we never forget about an internal event in schemas
 * when adding new ones.
 *
 * It also ensures that the mapped name is not the enum type, as this would
 * require a user to use the enum type to access the event schema to declare
 * triggers, where we want to allow them to use the string literal.
 *
 * @public
 */
type AssertInternalEventPayloads<T extends Record<internalEvents, EventPayload>> = { [K in keyof T as `${K & string}`]: Simplify<Omit<T[K], "name"> & {
  name: `${K & string}`;
}> };
/**
 * A string error used to highlight to a user that they have a clashing name
 * between the event name and the key of the event schema.
 */
type ClashingNameError = "Error: Omit 'name' from event schemas or make sure it matches the key.";
/**
 * Given a type T, check if any of the keys in T are a clashing name. If they
 * are, return the error type, otherwise return the original type.
 */
type CheckNever<T> = ClashingNameError extends T[keyof T] ? IsEmptyObject<T[keyof T]> extends true ? T : ClashingNameError : T;
/**
 * Given a type T, check if any of the keys in T are a clashing name. If they
 * are, return the error type for that key, otherwise return the original type.
 */
type PreventClashingNames<T> = CheckNever<{ [K in keyof T]: T[K] extends {
  name: infer N;
} ? N extends K ? T[K] : K extends `${string}*${string}` ? T[K] : ClashingNameError : T[K] }>;
/**
 * A literal Zod schema, which is a Zod schema that has a literal string as the
 * event name. This can be used to create correct Zod schemas outside of the
 * `EventSchemas` class.
 *
 * @public
 */
type LiteralZodEventSchema = ZodObject<{
  name: ZodLiteral<string>;
  data?: ValidZodValue;
  user?: ValidZodValue;
}>;
/**
 * An array of literal zod event schemas.
 *
 * @public
 */
type LiteralZodEventSchemas = LiteralZodEventSchema[];
/**
 * A helper type that declares a standardised custom part of the event schema,
 * defined using Zod.
 *
 * @public
 */
type ZodEventSchemas = Record<string, {
  data?: ValidZodValue;
  user?: ValidZodValue;
}>;
/**
 * A helper type that takes a union of Zod schemas and extracts the literal
 * matching event from the given schemas. Required when picking out types from
 * a union that require inference to work.
 *
 * @public
 */
type PickLiterals<T> = { [K in keyof T]: Extract<T[K], {
  name: ZodLiteral<K>;
}> };
/**
 * A helper type to extract the name from a given literal Zod schema.
 *
 * @public
 */
type GetName<T> = T extends ZodObject<infer U> ? U extends {
  name: ZodLiteral<infer S extends string>;
} ? S : never : never;
/**
 * Given an input T, infer the shape of the Zod schema if that input is a Zod
 * object.
 *
 * @public
 */
type InferZodShape<T> = T extends AnyZodObject ? T["shape"] : never;
/**
 * Given a set of literal Zod schemas, convert them into a record of Zod schemas
 * with the literal name as the key.
 *
 * @public
 */
type LiteralToRecordZodSchemas<T> = PickLiterals<T extends LiteralZodEventSchemas ? { [I in keyof T as GetName<T[I]>]: InferZodShape<T[I]> } : T extends ZodEventSchemas ? T : never>;
/**
 * Given a set of Zod schemas in a record format, convert them into a normalized
 * event schema format.
 *
 * @public
 */
type ZodToNormalizedSchema<T extends ZodEventSchemas> = { [EventName in keyof T & string]: { [Key in keyof T[EventName] & string]: T[EventName][Key] extends ZodTypeAny ? ZodInfer<T[EventName][Key]> : T[EventName][Key] } };
/**
 * A helper type to convert input schemas into the format expected by the
 * `EventSchemas` class, which ensures that each event contains all pieces of
 * information required.
 *
 * It purposefully uses slightly more complex (read: verbose) mapped types to
 * flatten the output and preserve comments.
 *
 * @public
 */
type NormalizedEventSchemaToPayload<T> = { [K in keyof T & string]: AddName<Simplify<Omit<EventPayload, keyof T[K]> & T[K]>, K> };
/**
 * A helper type to add a given name to each object in a type if it doesn't
 * exist as a string literal.
 *
 * Use in this way ensures simpler types can enforce preserving comments.
 */
type AddName<TObj, TDefaultName extends string> = TObj extends {
  name: string;
} ? IsStringLiteral<TObj["name"]> extends true ? TObj : Simplify<TObj & {
  name: TDefaultName;
}> : Simplify<TObj & {
  name: TDefaultName;
}>;
/**
 * A helper type to combine two event schemas together, ensuring the result is
 * as flat as possible and that we don't accidentally overwrite existing schemas
 * with a generic `string` key.
 *
 * @public
 */
type Combine<TCurr extends Record<string, EventPayload>, TInc extends NormalizedEventSchemas> = IsStringLiteral<keyof TCurr & string> extends true ? Simplify<Omit<TCurr, keyof NormalizedEventSchemaToPayload<TInc>> & NormalizedEventSchemaToPayload<TInc>> : NormalizedEventSchemaToPayload<TInc>;
/**
 * A record of event names to a schema for their data.
 */
type StandardSchemas = Record<string, StandardSchemaV1>;
/**
 * Conversion of Standard Schemas to the normalized type, including a literal of
 * the event name.
 */
type StandardToNormalizedSchema<T extends StandardSchemas> = { [K in keyof T & string]: AddName<{
  data: StandardSchemaV1.InferOutput<T[K]> extends Record<string, any> ? StandardSchemaV1.InferOutput<T[K]> : never;
}, K> };
/**
 * Provide an `EventSchemas` class to type events, providing type safety when
 * sending events and running functions via Inngest.
 *
 * You can provide generated Inngest types, custom types, types using Zod, or
 * a combination of the above. See {@link EventSchemas} for more information.
 *
 * @example
 *
 * ```ts
 * export const inngest = new Inngest({
 *   id: "my-app",
 *   schemas: new EventSchemas().fromZod({
 *     "app/user.created": {
 *       data: z.object({
 *         id: z.string(),
 *         name: z.string(),
 *       }),
 *     },
 *   }),
 * });
 * ```
 *
 * @public
 */
declare class EventSchemas<S extends Record<string, EventPayload> = AssertInternalEventPayloads<{
  [internalEvents.FunctionFailed]: FailureEventPayload;
  [internalEvents.FunctionFinished]: FinishedEventPayload;
  [internalEvents.FunctionInvoked]: InvokedEventPayload;
  [internalEvents.FunctionCancelled]: CancelledEventPayload;
  [internalEvents.ScheduledTimer]: ScheduledTimerEventPayload;
}>> {
  protected runtimeSchemas: Record<string, unknown>;
  private addRuntimeSchemas;
  /**
   * Use generated Inngest types to type events.
   */
  fromGenerated<T extends NormalizedEventSchemas>(): EventSchemas<Combine<S, T>>;
  /**
   * Use a `Record<>` type to type events.
   *
   * @example
   *
   * ```ts
   * export const inngest = new Inngest({
   *   id: "my-app",
   *   schemas: new EventSchemas().fromRecord<{
   *     "app/user.created": {
   *       data: {
   *         id: string;
   *         name: string;
   *       };
   *     };
   *   }>(),
   * });
   * ```
   */
  fromRecord<T extends NormalizedEventSchemas>(..._args: PreventClashingNames<T> extends ClashingNameError ? [ClashingNameError] : []): EventSchemas<Combine<S, T>>;
  /**
   * Use a union type to type events.
   *
   * @example
   *
   * ```ts
   * type AccountCreated = {
   *   name: "app/account.created";
   *   data: { org: string };
   *   user: { id: string };
   * };
   *
   * type AccountDeleted = {
   *   name: "app/account.deleted";
   *   data: { org: string };
   *   user: { id: string };
   * };
   *
   * type Events = AccountCreated | AccountDeleted;
   *
   * export const inngest = new Inngest({
   *   id: "my-app",
   *   schemas: new EventSchemas().fromUnion<Events>(),
   * });
   * ```
   */
  fromUnion<T extends {
    name: string;
  } & NormalizedEventSchema>(): EventSchemas<Combine<S, { [K in T["name"]]: Extract<T, {
    name: K;
  }> }>>;
  /**
   * Use Zod to type events.
   *
   * @deprecated Use {@link fromSchema}.
   *
   * @example
   *
   * ```ts
   * export const inngest = new Inngest({
   *   id: "my-app",
   *   schemas: new EventSchemas().fromZod({
   *     "app/user.created": {
   *       data: z.object({
   *         id: z.string(),
   *         name: z.string(),
   *       }),
   *     },
   *   }),
   * });
   * ```
   */
  fromZod<T extends ZodEventSchemas | LiteralZodEventSchemas>(schemas: T): EventSchemas<Combine<S, ZodToNormalizedSchema<T extends ZodEventSchemas ? T : LiteralToRecordZodSchemas<T>>>>;
  /**
   * Use anything compliant with Standard Schema to type events.
   *
   * @example
   *
   * ```ts
   * export const inngest = new Inngest({
   *   id: "my-app",
   *   schemas: new EventSchemas().fromSchema({
   *     "app/user.created": z.object({
   *       id: z.string(),
   *       name: z.string(),
   *     }),
   *   }),
   * });
   * ```
   */
  fromSchema<T extends StandardSchemas>(schemas: T): EventSchemas<Combine<S, StandardToNormalizedSchema<T>>>;
}
//#endregion
export { AddName, AssertInternalEventPayloads, Combine, EventSchemas, LiteralZodEventSchema, NormalizedEventSchemaToPayload, NormalizedEventSchemas, ZodEventSchemas };
//# sourceMappingURL=EventSchemas.d.cts.map