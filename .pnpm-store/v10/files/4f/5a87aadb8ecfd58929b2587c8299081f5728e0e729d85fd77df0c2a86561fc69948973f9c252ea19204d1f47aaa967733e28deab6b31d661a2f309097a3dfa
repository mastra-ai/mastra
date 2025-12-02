"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/webhooks.ts
var webhooks_exports = {};
__export(webhooks_exports, {
  verifyWebhook: () => verifyWebhook
});
module.exports = __toCommonJS(webhooks_exports);
var import_getEnvVariable = require("@clerk/shared/getEnvVariable");

// src/util/shared.ts
var import_url = require("@clerk/shared/url");
var import_retry = require("@clerk/shared/retry");
var import_keys = require("@clerk/shared/keys");
var import_deprecated = require("@clerk/shared/deprecated");
var import_error = require("@clerk/shared/error");
var import_keys2 = require("@clerk/shared/keys");
var errorThrower = (0, import_error.buildErrorThrower)({ packageName: "@clerk/backend" });
var { isDevOrStagingUrl } = (0, import_keys2.createDevOrStagingUrlCache)();

// src/webhooks.ts
var import_svix = require("svix");
var SVIX_ID_HEADER = "svix-id";
var SVIX_TIMESTAMP_HEADER = "svix-timestamp";
var SVIX_SIGNATURE_HEADER = "svix-signature";
var REQUIRED_SVIX_HEADERS = [SVIX_ID_HEADER, SVIX_TIMESTAMP_HEADER, SVIX_SIGNATURE_HEADER];
async function verifyWebhook(request, options = {}) {
  const secret = options.signingSecret ?? (0, import_getEnvVariable.getEnvVariable)("CLERK_WEBHOOK_SIGNING_SECRET");
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
  const sivx = new import_svix.Webhook(secret);
  const body = await request.text();
  return sivx.verify(body, {
    [SVIX_ID_HEADER]: svixId,
    [SVIX_TIMESTAMP_HEADER]: svixTimestamp,
    [SVIX_SIGNATURE_HEADER]: svixSignature
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  verifyWebhook
});
//# sourceMappingURL=webhooks.js.map