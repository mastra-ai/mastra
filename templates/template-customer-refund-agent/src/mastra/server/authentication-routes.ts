import { registerApiRoute } from "@mastra/core/server";
import { authenticateSeededCredentials, verifyLocalSession } from "./auth";
import {
  errorResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
} from "./contracts";

export const supportLoginRoute = registerApiRoute("/support/auth/login", {
  method: "POST",
  handler: async (c) => {
    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      return c.json(
        errorResponseSchema.parse({ error: "Invalid JSON body." }),
        400,
      );
    }
    const parsed = loginRequestSchema.safeParse(input);
    if (!parsed.success)
      return c.json(
        errorResponseSchema.parse({ error: "Invalid credentials payload." }),
        400,
      );
    const token = authenticateSeededCredentials(
      parsed.data.email,
      parsed.data.password,
    );
    if (!token)
      return c.json(
        errorResponseSchema.parse({ error: "Invalid credentials." }),
        401,
      );
    const session = verifyLocalSession(token)!;
    return c.json(
      loginResponseSchema.parse({
        token,
        expiresAt: session.expiresAt,
        principal: {
          id: session.id,
          email: session.email,
          tenantId: session.tenantId,
          roles: session.roles,
        },
      }),
    );
  },
});
