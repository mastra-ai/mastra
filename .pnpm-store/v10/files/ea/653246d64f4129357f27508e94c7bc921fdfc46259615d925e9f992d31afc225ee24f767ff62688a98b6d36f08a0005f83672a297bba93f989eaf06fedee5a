import type { IronSessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import type { Request, Response, NextFunction } from "express";
import getPropertyDescriptorForReqSession from "../src/getPropertyDescriptorForReqSession";

export function ironSession(
  sessionOptions: IronSessionOptions,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async function ironSessionMiddleware(req, res, next) {
    const session = await getIronSession(req, res, sessionOptions);
    Object.defineProperty(
      req,
      "session",
      getPropertyDescriptorForReqSession(session),
    );

    next();
  };
}
