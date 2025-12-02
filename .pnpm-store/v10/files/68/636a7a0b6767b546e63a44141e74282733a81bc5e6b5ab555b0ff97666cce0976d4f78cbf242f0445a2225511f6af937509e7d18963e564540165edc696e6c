import {
  errorThrower
} from "./chunk-LWOXHF4E.mjs";

// src/webhooks.ts
import { getEnvVariable } from "@clerk/shared/getEnvVariable";
import { Webhook } from "svix";
var SVIX_ID_HEADER = "svix-id";
var SVIX_TIMESTAMP_HEADER = "svix-timestamp";
var SVIX_SIGNATURE_HEADER = "svix-signature";
var REQUIRED_SVIX_HEADERS = [SVIX_ID_HEADER, SVIX_TIMESTAMP_HEADER, SVIX_SIGNATURE_HEADER];
async function verifyWebhook(request, options = {}) {
  const secret = options.signingSecret ?? getEnvVariable("CLERK_WEBHOOK_SIGNING_SECRET");
  const svixId = request.headers.get(SVIX_ID_HEADER);
  const svixTimestamp = request.headers.get(SVIX_TIMESTAMP_HEADER);
  const svixSignature = request.headers.get(SVIX_SIGNATURE_HEADER);
  if (!secret) {
    return errorThrower.throw(
      "Missing webhook signing secret. Set the CLERK_WEBHOOK_SIGNING_SECRET environment variable with the webhook secret from the Clerk Dashboard."
    );
  }
  if (!svixId || !svixTimestamp || !svixSignature) {
    const missingHeaders = REQUIRED_SVIX_HEADERS.filter((header) => !request.headers.has(header));
    return errorThrower.throw(`Missing required Svix headers: ${missingHeaders.join(", ")}`);
  }
  const sivx = new Webhook(secret);
  const body = await request.text();
  return sivx.verify(body, {
    [SVIX_ID_HEADER]: svixId,
    [SVIX_TIMESTAMP_HEADER]: svixTimestamp,
    [SVIX_SIGNATURE_HEADER]: svixSignature
  });
}
export {
  verifyWebhook
};
//# sourceMappingURL=webhooks.mjs.map