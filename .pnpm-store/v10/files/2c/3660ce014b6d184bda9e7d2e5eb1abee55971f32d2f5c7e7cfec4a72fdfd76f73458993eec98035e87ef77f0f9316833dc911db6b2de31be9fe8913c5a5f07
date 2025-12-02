import * as _better_auth_core8 from "@better-auth/core";

//#region src/plugins/captcha/constants.d.ts
declare const Providers: {
  readonly CLOUDFLARE_TURNSTILE: "cloudflare-turnstile";
  readonly GOOGLE_RECAPTCHA: "google-recaptcha";
  readonly HCAPTCHA: "hcaptcha";
  readonly CAPTCHAFOX: "captchafox";
};
//#endregion
//#region src/plugins/captcha/types.d.ts
interface BaseCaptchaOptions {
  secretKey: string;
  endpoints?: string[] | undefined;
  siteVerifyURLOverride?: string | undefined;
}
interface GoogleRecaptchaOptions extends BaseCaptchaOptions {
  provider: typeof Providers.GOOGLE_RECAPTCHA;
  minScore?: number | undefined;
}
interface CloudflareTurnstileOptions extends BaseCaptchaOptions {
  provider: typeof Providers.CLOUDFLARE_TURNSTILE;
}
interface HCaptchaOptions extends BaseCaptchaOptions {
  provider: typeof Providers.HCAPTCHA;
  siteKey?: string | undefined;
}
interface CaptchaFoxOptions extends BaseCaptchaOptions {
  provider: typeof Providers.CAPTCHAFOX;
  siteKey?: string | undefined;
}
type CaptchaOptions = GoogleRecaptchaOptions | CloudflareTurnstileOptions | HCaptchaOptions | CaptchaFoxOptions;
//#endregion
//#region src/plugins/captcha/index.d.ts
declare const captcha: (options: CaptchaOptions) => {
  id: "captcha";
  onRequest: (request: Request, ctx: _better_auth_core8.AuthContext) => Promise<{
    response: Response;
  } | undefined>;
};
//#endregion
export { captcha as t };