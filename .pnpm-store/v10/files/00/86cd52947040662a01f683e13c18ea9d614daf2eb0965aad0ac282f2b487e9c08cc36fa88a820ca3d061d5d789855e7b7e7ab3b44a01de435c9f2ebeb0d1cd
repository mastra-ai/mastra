import crypto from "crypto";

/**
 * Default options for JWT signature
 */
const defaultHeader = { alg: "HS256", typ: "JWT" } as const;

/**
 * Return a base64 URL
 *
 * @param {string} data - some data to be base64 encoded
 * @return {string} A base64url encoded string
 */
function base64url(data: string): string {
  return Buffer.from(data, "utf8")
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Create a very basic JWT signature
 *
 * @param {Object} data - the data object you want to have signed
 * @param {string} secret - secret to use to sign token with
 * @param {Object} options - JWT header options
 * @return {string} JSON Web Token that has been signed
 */
function sign(
  data: Record<string, any>,
  secret: string,
  options: Record<string, any> = {},
): string {
  const header = Object.assign(defaultHeader, options);
  // Original code had && here instead of ||, that doesn't make sense to me
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error(
      "jwt-encode only support the HS256 algorithm and the JWT type of hash",
    );
  }

  const encodedHeader = encode(header);
  const encodedData = encode(data);

  let signature = `${encodedHeader}.${encodedData}`;
  signature = crypto
    .createHmac("sha256", secret)
    .update(signature)
    .digest("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedData}.${signature}`;
}

/**
 *  Safely base64url encode a JS Object in a way that is UTF-8 safe
 *
 *  @param {Object} data - JavaScript object payload to be encoded
 *  @return {string} utf-8 safe base64url encoded payload
 */
function encode(data: Record<string, any>): string {
  return base64url(JSON.stringify(data));
}

export { sign as jwtEncode };
