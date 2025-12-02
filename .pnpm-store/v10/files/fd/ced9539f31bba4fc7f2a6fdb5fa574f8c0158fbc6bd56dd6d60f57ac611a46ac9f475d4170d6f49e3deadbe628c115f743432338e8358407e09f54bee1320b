import { Realtime } from "./types.mjs";

//#region src/hooks.d.ts
declare enum InngestSubscriptionState {
  Closed = "closed",
  Error = "error",
  RefreshingToken = "refresh_token",
  Connecting = "connecting",
  Active = "active",
  Closing = "closing",
}
/**
 * TODO
 */
interface InngestSubscription<TToken extends Realtime.Subscribe.Token> {
  /**
   * TODO
   */
  data: Realtime.Subscribe.Token.InferMessage<TToken>[];
  /**
   * TODO
   */
  latestData: Realtime.Subscribe.Token.InferMessage<TToken> | null;
  /**
   * TODO
   */
  freshData: Realtime.Subscribe.Token.InferMessage<TToken>[];
  /**
   * TODO
   */
  error: Error | null;
  /**
   * TODO
   */
  state: InngestSubscriptionState;
}
/**
 * TODO
 */
declare function useInngestSubscription<const TToken extends Realtime.Subscribe.Token | null | undefined>({
  token: tokenInput,
  refreshToken,
  key,
  enabled,
  bufferInterval
}: {
  /**
   * TODO
   */
  token?: TToken;
  /**
   * TODO
   */
  refreshToken?: () => Promise<TToken>;
  /**
   * TODO
   */
  key?: string;
  /**
   * TODO
   */
  enabled?: boolean;
  /**
   * TODO
   */
  bufferInterval?: number;
}): InngestSubscription<NonNullable<TToken>>;
//#endregion
export { InngestSubscription, InngestSubscriptionState, useInngestSubscription };
//# sourceMappingURL=hooks.d.mts.map