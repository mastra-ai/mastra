import type { IronSessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import * as Koa from "koa";
import getPropertyDescriptorForReqSession from "../src/getPropertyDescriptorForReqSession";

export function ironSession(
  sessionOptions: IronSessionOptions,
): (ctx: Koa.Context, next: Koa.Next) => Promise<void> {
  return async function ironSessionMiddleWare(ctx, next) {
    const session = await getIronSession(ctx.req, ctx.res, sessionOptions);
    Object.defineProperty(
      ctx,
      "session",
      getPropertyDescriptorForReqSession(session),
    );

    await next();
  }
}
