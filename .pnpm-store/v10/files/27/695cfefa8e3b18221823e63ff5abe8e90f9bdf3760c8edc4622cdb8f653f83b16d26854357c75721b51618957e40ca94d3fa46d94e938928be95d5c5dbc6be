import { Realtime } from "../types.js";
import { Inngest } from "inngest";

//#region src/subscribe/helpers.d.ts

/**
 * TODO
 */
declare const subscribe: <const InputChannel extends Realtime.Channel | string, const InputTopics extends (keyof Realtime.Channel.InferTopics<Realtime.Channel.AsChannel<InputChannel>> & string)[], const TToken extends Realtime.Subscribe.Token<Realtime.Channel.AsChannel<InputChannel>, InputTopics>, const TOutput extends Realtime.Subscribe.StreamSubscription<TToken>>(
/**
 * TODO
 */
token: {
  /**
   * TODO
   */
  app?: Inngest.Like;
  /**
   * TODO
   */
  channel: Realtime.Subscribe.InferChannelInput<InputChannel>;
  /**
   * TODO
   */
  topics: InputTopics;
},
/**
 * TODO
 */
callback?: Realtime.Subscribe.Callback<TToken>) => Promise<TOutput>;
/**
 * TODO
 */
declare const getSubscriptionToken: <const InputChannel extends Realtime.Channel | string, const InputTopics extends (keyof Realtime.Channel.InferTopics<Realtime.Channel.AsChannel<InputChannel>> & string)[], const TToken extends Realtime.Subscribe.Token<Realtime.Channel.AsChannel<InputChannel>, InputTopics>>(
/**
 * TODO
 */
app: Inngest.Like,
/**
 * TODO
 */
args: {
  /**
   * TODO
   */
  channel: Realtime.Subscribe.InferChannelInput<InputChannel>;
  /**
   * TODO
   */
  topics: InputTopics;
}) => Promise<TToken>;
//#endregion
export { getSubscriptionToken, subscribe };
//# sourceMappingURL=helpers.d.ts.map