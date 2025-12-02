import { z } from "zod/v3";
import { StandardSchemaV1 } from "@standard-schema/spec";

//#region src/types.d.ts
declare namespace Realtime {
  type PublishFn = <TMessage extends MaybePromise<Realtime.Message.Input>>(message: TMessage) => Promise<Awaited<TMessage>["data"]>;
  type Token<TChannel extends Channel | Channel.Definition, TTopics extends (keyof Channel.InferTopics<Channel.Definition.AsChannel<TChannel>> & string)[] = (keyof Channel.InferTopics<Channel.Definition.AsChannel<TChannel>> & string)[]> = TChannel extends Channel.Definition ? Subscribe.Token<Channel.Definition.AsChannel<TChannel>, TTopics> : TChannel extends Channel ? Subscribe.Token<TChannel, TTopics> : never;
  namespace Subscribe {
    type InferChannelInput<T> = T extends Realtime.Channel.Definition ? Realtime.Channel.Definition.InferId<T> : T;
    type StreamSubscription<TSubscribeToken extends Token = Token, TData extends Simplify<Token.InferMessage<TSubscribeToken>> = Simplify<Token.InferMessage<TSubscribeToken>>> = ReadableStream<TData> & {
      /**
       * Get a new readable stream from the subscription that delivers JSON chunks.
       *
       * The stream starts when this function is called and will not contain any
       * messages that were sent before this function was called.
       */
      getJsonStream(): ReadableStream<TData>;
      /**
       * Get a new readable stream from the subscription that delivers
       * SSE-compatible chunks, which are compatible with the `EventSource` API
       * and generally used for streaming data from a server to the browser.
       *
       * The stream starts when this function is called and will not contain any
       * messages that were sent before this function was called.
       */
      getEncodedStream(): ReadableStream<Uint8Array>;
    };
    type Callback<TSubscribeToken extends Subscribe.Token = Subscribe.Token> = (message: Token.InferMessage<TSubscribeToken>) => void;
    interface Token<TChannel extends Channel | Channel.Definition = Channel, TTopics extends (keyof Channel.InferTopics<TChannel>)[] = (keyof Channel.InferTopics<TChannel>)[]> {
      key?: string | undefined;
      channel: Realtime.Channel.Definition.AsChannel<TChannel>;
      topics: TTopics;
    }
    namespace Token {
      type InferChannel<TToken extends Token> = TToken extends Token<infer IChannel, any> ? IChannel : Channel;
      type InferTopicData<TToken extends Token, TChannelTopics extends Record<string, Topic.Definition> = Channel.InferTopics<Token.InferChannel<TToken>>> = TToken extends Token<any, infer ITopics> ? { [K in ITopics[number]]: TChannelTopics[K] } : never;
      type InferMessage<TToken extends Token> = Simplify<Realtime.Message<Channel.InferId<Token.InferChannel<TToken>>, Token.InferTopicData<TToken>>>;
    }
  }
  const messageSchema: z.ZodEffects<z.ZodObject<{
    channel: z.ZodOptional<z.ZodString>;
    topic: z.ZodOptional<z.ZodString>;
    data: z.ZodAny;
    run_id: z.ZodOptional<z.ZodString>;
    fn_id: z.ZodOptional<z.ZodString>;
    created_at: z.ZodEffects<z.ZodOptional<z.ZodString>, Date | undefined, string | undefined>;
    env_id: z.ZodOptional<z.ZodString>;
    stream_id: z.ZodOptional<z.ZodString>;
    kind: z.ZodEnum<["step", "run", "data", "ping", "pong", "closing", "event", "sub", "unsub", "datastream-start", "datastream-end", "chunk"]>;
  }, "strip", z.ZodTypeAny, {
    kind: "event" | "data" | "sub" | "step" | "run" | "ping" | "pong" | "closing" | "unsub" | "datastream-start" | "datastream-end" | "chunk";
    data?: any;
    channel?: string | undefined;
    topic?: string | undefined;
    run_id?: string | undefined;
    fn_id?: string | undefined;
    created_at?: Date | undefined;
    env_id?: string | undefined;
    stream_id?: string | undefined;
  }, {
    kind: "event" | "data" | "sub" | "step" | "run" | "ping" | "pong" | "closing" | "unsub" | "datastream-start" | "datastream-end" | "chunk";
    data?: any;
    channel?: string | undefined;
    topic?: string | undefined;
    run_id?: string | undefined;
    fn_id?: string | undefined;
    created_at?: string | undefined;
    env_id?: string | undefined;
    stream_id?: string | undefined;
  }>, {
    data: any;
    kind: "event" | "data" | "sub" | "step" | "run" | "ping" | "pong" | "closing" | "unsub" | "datastream-start" | "datastream-end" | "chunk";
    channel?: string | undefined;
    topic?: string | undefined;
    run_id?: string | undefined;
    fn_id?: string | undefined;
    created_at?: Date | undefined;
    env_id?: string | undefined;
    stream_id?: string | undefined;
  }, {
    kind: "event" | "data" | "sub" | "step" | "run" | "ping" | "pong" | "closing" | "unsub" | "datastream-start" | "datastream-end" | "chunk";
    data?: any;
    channel?: string | undefined;
    topic?: string | undefined;
    run_id?: string | undefined;
    fn_id?: string | undefined;
    created_at?: string | undefined;
    env_id?: string | undefined;
    stream_id?: string | undefined;
  }>;
  type Message<TChannelId extends string = string, TTopics extends Record<string, Realtime.Topic.Definition> = Record<string, Realtime.Topic.Definition>> = { [K in keyof TTopics]: {
    topic: K;
    channel: TChannelId;
    data: Realtime.Topic.InferSubscribe<TTopics[K]>;
    runId?: string;
    fnId?: string;
    createdAt: Date;
    envId?: string;
    kind: "data";
  } | {
    topic: K;
    channel: TChannelId;
    data: Realtime.Topic.InferSubscribe<TTopics[K]>;
    runId?: string;
    fnId?: string;
    kind: "datastream-start" | "datastream-end" | "chunk";
    streamId: string;
    stream: ReadableStream<Realtime.Topic.InferSubscribe<TTopics[K]>>;
  } }[keyof TTopics];
  namespace Message {
    type Input<TChannelId extends string = string, TTopicId extends string = string, TData = any> = {
      channel: TChannelId;
      topic: TTopicId;
      data: TData;
    };
    type Raw<TChannelId extends string = string, TTopics extends Record<string, Realtime.Topic.Definition> = Record<string, Realtime.Topic.Definition>> = { [K in keyof TTopics]: {
      topic?: K;
      stream_id?: string;
      data: Realtime.Topic.InferSubscribe<TTopics[K]>;
      channel?: TChannelId;
      run_id?: string;
      fn_id?: string;
      created_at?: Date;
      env_id?: string;
      kind: "step" | "run" | "data" | "datastream-start" | "datastream-end" | "ping" | "pong" | "closing" | "event" | "sub" | "unsub" | "chunk";
    } }[keyof TTopics];
  }
  type Channel<TChannelId extends string = string, TTopics extends Record<string, Realtime.Topic.Definition> = Record<string, Realtime.Topic.Definition>> = { [K in IsLiteral<keyof TTopics, keyof TTopics, never> | "name" | "topics"]: K extends "name" ? string : K extends "topics" ? TTopics : Realtime.Topic<TChannelId, TTopics[K]> };
  namespace Channel {
    type Like = {
      channel: string;
      topics: string[];
    };
    type InferId<TChannel extends Channel> = TChannel extends Channel<infer IId, any> ? IId : string;
    type AsChannel<T extends Channel | string> = T extends Channel ? T : T extends string ? Realtime.Channel<T> : never;
    type InferTopics<TChannel extends Channel | Channel.Definition> = TChannel extends Channel.Definition<any, infer ITopics> ? ITopics : TChannel extends Channel<any, infer ITopics> ? ITopics : Record<string, Realtime.Topic.Definition>;
    interface Definition<TChannelBuilderFn extends BuilderFn = (...args: any[]) => string, TTopics extends Record<string, Topic.Definition> = Record<string, Topic.Definition>> {
      (...args: Parameters<TChannelBuilderFn>): Channel<ReturnType<TChannelBuilderFn>, TTopics>;
      addTopic<UTopic extends Topic.Definition>(topic: UTopic): Definition<TChannelBuilderFn, AddTopic<TTopics, UTopic>>;
      topics: TTopics;
    }
    namespace Definition {
      type InferId<TChannel extends Definition> = TChannel extends Definition<infer IBuilder, any> ? ReturnType<IBuilder> : string;
      type InferTopics<TChannel extends Definition> = TChannel extends Definition<any, infer ITopics> ? ITopics : Record<string, Topic.Definition>;
      type AsChannel<T extends Definition | Channel> = T extends Definition ? Channel<InferId<T>, InferTopics<T>> : T extends Channel ? T : never;
    }
    type AddTopic<TCurr extends Record<string, Topic.Definition>, TInc extends Topic.Definition, TIncWrapped extends Record<TInc["name"], TInc> = Record<TInc["name"], TInc>> = IsStringLiteral<keyof TCurr & string> extends true ? Simplify<Omit<TCurr, TInc["name"]> & TIncWrapped> : TIncWrapped;
    type BuilderFn<TChannelId extends string = string> = (...args: any[]) => TChannelId;
    type Builder = <const TChannelId extends string, const TIdInput extends TChannelId | BuilderFn<TChannelId>>(id: TIdInput) => TIdInput extends TChannelId ? Channel.Definition<() => TIdInput> : TIdInput extends BuilderFn<TChannelId> ? Channel.Definition<TIdInput> : never;
  }
  type Topic<TChannelId extends string = string, TTopic extends Topic.Definition = Topic.Definition> = (data: Topic.InferPublish<TTopic>) => Promise<Realtime.Message.Input<TChannelId, Topic.InferId<TTopic>, Topic.InferPublish<TTopic>>>;
  namespace Topic {
    type Like = {
      name: string;
    };
    interface Definition<TTopicId extends string = string, TPublish = any, _TSubscribe = TPublish> {
      name: TTopicId;
      type<const UPublish>(): Definition<TTopicId, UPublish>;
      schema<const TSchema extends StandardSchemaV1>(schema: TSchema): Definition<TTopicId, StandardSchemaV1.InferInput<TSchema>, StandardSchemaV1.InferOutput<TSchema>>;
      getSchema(): StandardSchemaV1 | undefined;
    }
    type InferId<TTopic extends Topic.Definition> = TTopic extends Topic.Definition<infer IId, any, any> ? IId : string;
    type InferPublish<TTopic extends Topic.Definition> = TTopic extends Topic.Definition<any, infer IPublish, any> ? IPublish : any;
    type InferSubscribe<TTopic extends Topic.Definition> = TTopic extends Topic.Definition<any, any, infer ISubscribe> ? ISubscribe : any;
    type Builder = <const TTopicId extends string>(id: TTopicId) => Topic.Definition<TTopicId>;
  }
}
/**
 * Expects that a value resolves to `true`, useful for asserting type checks.
 */
type Expect<T extends true> = T;
/**
Returns a boolean for whether the two given types are equal.

{@link https://github.com/microsoft/TypeScript/issues/27024#issuecomment-421529650}
{@link https://stackoverflow.com/questions/68961864/how-does-the-equals-work-in-typescript/68963796#68963796}

Use-cases:
- If you want to make a conditional branch based on the result of a comparison of two types.

@example
```
import type {IsEqual} from 'type-fest';

// This type returns a boolean for whether the given array includes the given item.
// `IsEqual` is used to compare the given array at position 0 and the given item and then return true if they are equal.
type Includes<Value extends readonly any[], Item> =
    Value extends readonly [Value[0], ...infer rest]
        ? IsEqual<Value[0], Item> extends true
            ? true
            : Includes<rest, Item>
        : false;
```
*/
type IsEqual<A, B> = (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? true : false;
/**
 * Given a type `T`, return `Then` if `T` is a string, number, or symbol
 * literal, else `Else`.
 *
 * `Then` defaults to `true` and `Else` defaults to `false`.
 *
 * Useful for determining if an object is a generic type or has known keys.
 *
 * @example
 * ```ts
 * type IsLiteralType = IsLiteral<"foo">; // true
 * type IsLiteralType = IsLiteral<string>; // false
 *
 * type IsLiteralType = IsLiteral<1>; // true
 * type IsLiteralType = IsLiteral<number>; // false
 *
 * type IsLiteralType = IsLiteral<symbol>; // true
 * type IsLiteralType = IsLiteral<typeof Symbol.iterator>; // false
 *
 * type T0 = { foo: string };
 * type HasAllKnownKeys = IsLiteral<keyof T0>; // true
 *
 * type T1 = { [x: string]: any; foo: boolean };
 * type HasAllKnownKeys = IsLiteral<keyof T1>; // false
 * ```
 */
type IsLiteral<T, Then = true, Else = false> = string extends T ? Else : number extends T ? Else : symbol extends T ? Else : Then;
/**
 * Returns `true` if the given generic `T` is a string literal, e.g. `"foo"`, or
 * `false` if it is a string type, e.g. `string`.
 *
 * Useful for checking whether the keys of an object are known or not.
 *
 * @example
 * ```ts
 * // false
 * type ObjIsGeneric = IsStringLiteral<keyof Record<string, boolean>>;
 *
 * // true
 * type ObjIsKnown = IsStringLiteral<keyof { foo: boolean; }>; // true
 * ```
 *
 * @internal
 */
type IsStringLiteral<T extends string> = string extends T ? false : true;
/**
 * Returns the given generic as either itself or a promise of itself.
 */
type MaybePromise<T> = T | Promise<T>;
type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};
//#endregion
export { Expect, IsEqual, IsLiteral, IsStringLiteral, MaybePromise, Realtime, Simplify };
//# sourceMappingURL=types.d.mts.map