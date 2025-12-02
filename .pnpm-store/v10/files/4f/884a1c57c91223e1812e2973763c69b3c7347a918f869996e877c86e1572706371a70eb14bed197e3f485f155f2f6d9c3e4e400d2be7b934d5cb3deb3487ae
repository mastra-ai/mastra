'use strict';

const base32 = require('./base32.cjs');
const hmac = require('./hmac.cjs');
require('./hex.cjs');
require('./base64.cjs');
require('./index.cjs');

const defaultPeriod = 30;
const defaultDigits = 6;
async function generateHOTP(secret, {
  counter,
  digits,
  hash = "SHA-1"
}) {
  const _digits = digits ?? defaultDigits;
  if (_digits < 1 || _digits > 8) {
    throw new TypeError("Digits must be between 1 and 8");
  }
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigUint64(0, BigInt(counter), false);
  const bytes = new Uint8Array(buffer);
  const hmacResult = new Uint8Array(await hmac.createHMAC(hash).sign(secret, bytes));
  const offset = hmacResult[hmacResult.length - 1] & 15;
  const truncated = (hmacResult[offset] & 127) << 24 | (hmacResult[offset + 1] & 255) << 16 | (hmacResult[offset + 2] & 255) << 8 | hmacResult[offset + 3] & 255;
  const otp = truncated % 10 ** _digits;
  return otp.toString().padStart(_digits, "0");
}
async function generateTOTP(secret, options) {
  const digits = options?.digits ?? defaultDigits;
  const period = options?.period ?? defaultPeriod;
  const milliseconds = period * 1e3;
  const counter = Math.floor(Date.now() / milliseconds);
  return await generateHOTP(secret, { counter, digits, hash: options?.hash });
}
async function verifyTOTP(otp, {
  window = 1,
  digits = defaultDigits,
  secret,
  period = defaultPeriod
}) {
  const milliseconds = period * 1e3;
  const counter = Math.floor(Date.now() / milliseconds);
  for (let i = -window; i <= window; i++) {
    const generatedOTP = await generateHOTP(secret, {
      counter: counter + i,
      digits
    });
    if (otp === generatedOTP) {
      return true;
    }
  }
  return false;
}
function generateQRCode({
  issuer,
  account,
  secret,
  digits = defaultDigits,
  period = defaultPeriod
}) {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccountName = encodeURIComponent(account);
  const baseURI = `otpauth://totp/${encodedIssuer}:${encodedAccountName}`;
  const params = new URLSearchParams({
    secret: base32.base32.encode(secret, {
      padding: false
    }),
    issuer
  });
  if (digits !== void 0) {
    params.set("digits", digits.toString());
  }
  if (period !== void 0) {
    params.set("period", period.toString());
  }
  return `${baseURI}?${params.toString()}`;
}
const createOTP = (secret, opts) => {
  const digits = opts?.digits ?? defaultDigits;
  const period = opts?.period ?? defaultPeriod;
  return {
    hotp: (counter) => generateHOTP(secret, { counter, digits }),
    totp: () => generateTOTP(secret, { digits, period }),
    verify: (otp, options) => verifyTOTP(otp, { secret, digits, period, ...options }),
    url: (issuer, account) => generateQRCode({ issuer, account, secret, digits, period })
  };
};

exports.createOTP = createOTP;
