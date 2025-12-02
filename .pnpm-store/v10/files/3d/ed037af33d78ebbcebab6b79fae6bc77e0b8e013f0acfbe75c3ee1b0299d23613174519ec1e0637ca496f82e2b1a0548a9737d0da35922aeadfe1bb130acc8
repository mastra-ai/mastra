"use strict";
import crypto from "crypto";
const defaultHeader = { alg: "HS256", typ: "JWT" };
function base64url(data) {
  return Buffer.from(data, "utf8").toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function sign(data, secret, options = {}) {
  const header = Object.assign(defaultHeader, options);
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error(
      "jwt-encode only support the HS256 algorithm and the JWT type of hash"
    );
  }
  const encodedHeader = encode(header);
  const encodedData = encode(data);
  let signature = `${encodedHeader}.${encodedData}`;
  signature = crypto.createHmac("sha256", secret).update(signature).digest("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encodedHeader}.${encodedData}.${signature}`;
}
function encode(data) {
  return base64url(JSON.stringify(data));
}
export { sign as jwtEncode };
//# sourceMappingURL=index.js.map
