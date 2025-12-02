import { Realtime } from "./types.mjs";
import { StandardSchemaV1 } from "@standard-schema/spec";

//#region src/topic.d.ts

/**
 * TODO
 */
declare const topic: Realtime.Topic.Builder;
declare class TopicDefinitionImpl<TTopicId extends string = string, TPublish = any, TSubscribe = TPublish> implements Realtime.Topic.Definition<TTopicId, TPublish, TSubscribe> {
  #private;
  name: TTopicId;
  constructor(name: TTopicId, schema?: StandardSchemaV1);
  type<const UPublish, const USubscribe = UPublish>(): Realtime.Topic.Definition<TTopicId, UPublish, USubscribe>;
  schema<const TSchema extends StandardSchemaV1>(schema: TSchema): Realtime.Topic.Definition<TTopicId, StandardSchemaV1.InferInput<TSchema>, StandardSchemaV1.InferOutput<TSchema>>;
  getSchema(): StandardSchemaV1 | undefined;
}
//#endregion
export { TopicDefinitionImpl, topic };
//# sourceMappingURL=topic.d.mts.map