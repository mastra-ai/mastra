import { ironSession } from ".";
import { createMockContext } from "@shopify/jest-koa-mocks";

const password = "Gbm49ATjnqnkCCCdhV4uDBhbfnPqsCW0";
const cookieName = "test";

// same structure as other tests otherwise linting will fail because you can have only one per running eslint
declare module "iron-session" {
  interface IronSessionData {
    user?: { id: number; meta?: string };
    admin?: boolean;
  }
}

test("ironSession: ctx.session exists", async () => {
  const wrappedHandler = ironSession({
    password,
    cookieName,
  });

  const ctx = createMockContext();

  await wrappedHandler(ctx, ctx => ctx);
  expect(ctx.session).toMatchInlineSnapshot(`Object {}`);
});
