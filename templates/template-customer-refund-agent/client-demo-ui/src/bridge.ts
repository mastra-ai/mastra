import { createHmac, timingSafeEqual } from "node:crypto";
import type { DemoCustomer } from "./types.js";
import { appMode } from "../../config/app-mode.mjs";

const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const key = () => process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY;
export function issueBackendBridge(customer: DemoCustomer, expiresAt: string) {
  const signingKey = key();
  if (!signingKey || signingKey.length < 32) return undefined;
  const payload = encode({
    id: customer.id,
    email: customer.email,
    tenantId: customer.tenantId,
    roles: ["customer"],
    expiresAt,
    appMode: appMode(),
    intercomContactId: customer.intercomContactId,
    stripeCustomerId: customer.stripeCustomerId,
  });
  return `${payload}.${createHmac("sha256", signingKey).update(payload).digest("base64url")}`;
}
export function issueMessengerJwt(customer: DemoCustomer, expiresAt: string) {
  const signingKey = process.env.INTERCOM_MESSENGER_JWT_SECRET;
  if (!signingKey) return undefined;
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    user_id: customer.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.parse(expiresAt) / 1000),
  });
  const signature = createHmac("sha256", signingKey)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}
export function verifyBridgeForTest(token: string, signingKey: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", signingKey)
    .update(payload)
    .digest("base64url");
  const left = Buffer.from(signature),
    right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
