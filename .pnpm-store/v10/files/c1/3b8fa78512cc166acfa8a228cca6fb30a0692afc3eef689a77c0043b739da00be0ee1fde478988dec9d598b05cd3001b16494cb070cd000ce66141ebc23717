import { Request, Response } from "express";
import { ironSession } from ".";
const password = "Gbm49ATjnqnkCCCdhV4uDBhbfnPqsCW0";
const cookieName = "test";

// same structure as other tests otherwise linting will fail because you can have only one per running eslint
declare module "iron-session" {
  interface IronSessionData {
    user?: { id: number; meta?: string };
    admin?: boolean;
  }
}

test("ironSession: req.session exists", async () => {
  const wrappedHandler = ironSession({
    password,
    cookieName,
  });

  const req = getDefaultReq();

  await wrappedHandler(req, getDefaultRes(), function () {
    expect(req.session).toMatchInlineSnapshot(`Object {}`);
  });
});

function getDefaultReq() {
  return {
    headers: {},
    socket: {
      encrypted: true,
    },
  } as unknown as Request;
}

function getDefaultRes() {
  return {
    getHeader: jest.fn(),
    setHeader: jest.fn(),
  } as unknown as Response;
}
