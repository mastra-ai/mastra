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

// src/error.ts
var error_exports = {};
__export(error_exports, {
  ClerkAPIError: () => ClerkAPIError,
  ClerkAPIResponseError: () => ClerkAPIResponseError,
  ClerkRuntimeError: () => ClerkRuntimeError,
  ClerkWebAuthnError: () => ClerkWebAuthnError,
  EmailLinkError: () => EmailLinkError,
  EmailLinkErrorCode: () => EmailLinkErrorCode,
  EmailLinkErrorCodeStatus: () => EmailLinkErrorCodeStatus,
  buildErrorThrower: () => buildErrorThrower,
  errorToJSON: () => errorToJSON,
  is4xxError: () => is4xxError,
  isCaptchaError: () => isCaptchaError,
  isClerkAPIResponseError: () => isClerkAPIResponseError,
  isClerkRuntimeError: () => isClerkRuntimeError2,
  isEmailLinkError: () => isEmailLinkError,
  isKnownError: () => isKnownError,
  isMetamaskError: () => isMetamaskError,
  isNetworkError: () => isNetworkError,
  isPasswordPwnedError: () => isPasswordPwnedError,
  isReverificationCancelledError: () => isReverificationCancelledError,
  isUnauthorizedError: () => isUnauthorizedError,
  isUserLockedError: () => isUserLockedError,
  parseError: () => parseError,
  parseErrors: () => parseErrors
});
module.exports = __toCommonJS(error_exports);

// src/errors/createErrorTypeGuard.ts
function createErrorTypeGuard(ErrorClass) {
  function typeGuard(error) {
    const target = error ?? this;
    if (!target) {
      throw new TypeError(`${ErrorClass.kind || ErrorClass.name} type guard requires an error object`);
    }
    return target instanceof ErrorClass;
  }
  return typeGuard;
}

// src/errors/clerkApiError.ts
var ClerkAPIError = class {
  static kind = "ClerkApiError";
  code;
  message;
  longMessage;
  meta;
  constructor(json) {
    const parsedError = this.parseJsonError(json);
    this.code = parsedError.code;
    this.message = parsedError.message;
    this.longMessage = parsedError.longMessage;
    this.meta = parsedError.meta;
  }
  parseJsonError(json) {
    return {
      code: json.code,
      message: json.message,
      longMessage: json.long_message,
      meta: {
        paramName: json.meta?.param_name,
        sessionId: json.meta?.session_id,
        emailAddresses: json.meta?.email_addresses,
        identifiers: json.meta?.identifiers,
        zxcvbn: json.meta?.zxcvbn,
        plan: json.meta?.plan,
        isPlanUpgradePossible: json.meta?.is_plan_upgrade_possible
      }
    };
  }
};
var isClerkApiError = createErrorTypeGuard(ClerkAPIError);

// src/errors/parseError.ts
function parseErrors(data = []) {
  return data.length > 0 ? data.map((e) => new ClerkAPIError(e)) : [];
}
function parseError(error) {
  return new ClerkAPIError(error);
}
function errorToJSON(error) {
  return {
    code: error?.code || "",
    message: error?.message || "",
    long_message: error?.longMessage,
    meta: {
      param_name: error?.meta?.paramName,
      session_id: error?.meta?.sessionId,
      email_addresses: error?.meta?.emailAddresses,
      identifiers: error?.meta?.identifiers,
      zxcvbn: error?.meta?.zxcvbn,
      plan: error?.meta?.plan,
      is_plan_upgrade_possible: error?.meta?.isPlanUpgradePossible
    }
  };
}

// src/errors/clerkError.ts
var __DEV__ = true;
var ClerkError = class _ClerkError extends Error {
  static kind = "ClerkError";
  clerkError = true;
  code;
  longMessage;
  docsUrl;
  cause;
  get name() {
    return this.constructor.name;
  }
  constructor(opts) {
    super(new.target.formatMessage(new.target.kind, opts.message, opts.code, opts.docsUrl), { cause: opts.cause });
    Object.setPrototypeOf(this, _ClerkError.prototype);
    this.code = opts.code;
    this.docsUrl = opts.docsUrl;
    this.longMessage = opts.longMessage;
    this.cause = opts.cause;
  }
  toString() {
    return `[${this.name}]
Message:${this.message}`;
  }
  static formatMessage(name, msg, code, docsUrl) {
    const prefix = "Clerk:";
    const regex = new RegExp(prefix.replace(" ", "\\s*"), "i");
    msg = msg.replace(regex, "");
    msg = `${prefix} ${msg.trim()}

(code="${code}")

`;
    if (__DEV__ && docsUrl) {
      msg += `

Docs: ${docsUrl}`;
    }
    return msg;
  }
};

// src/errors/clerkApiResponseError.ts
var ClerkAPIResponseError = class _ClerkAPIResponseError extends ClerkError {
  static kind = "ClerkAPIResponseError";
  status;
  clerkTraceId;
  retryAfter;
  errors;
  constructor(message, options) {
    const { data: errorsJson, status, clerkTraceId, retryAfter } = options;
    super({ ...options, message, code: "api_response_error" });
    Object.setPrototypeOf(this, _ClerkAPIResponseError.prototype);
    this.status = status;
    this.clerkTraceId = clerkTraceId;
    this.retryAfter = retryAfter;
    this.errors = (errorsJson || []).map((e) => new ClerkAPIError(e));
  }
  toString() {
    let message = `[${this.name}]
Message:${this.message}
Status:${this.status}
Serialized errors: ${this.errors.map(
      (e) => JSON.stringify(e)
    )}`;
    if (this.clerkTraceId) {
      message += `
Clerk Trace ID: ${this.clerkTraceId}`;
    }
    return message;
  }
  // Override formatMessage to keep it unformatted for backward compatibility
  static formatMessage(name, msg, _, __) {
    return msg;
  }
};
var isClerkApiResponseError = createErrorTypeGuard(ClerkAPIResponseError);

// src/errors/errorThrower.ts
var DefaultMessages = Object.freeze({
  InvalidProxyUrlErrorMessage: `The proxyUrl passed to Clerk is invalid. The expected value for proxyUrl is an absolute URL or a relative path with a leading '/'. (key={{url}})`,
  InvalidPublishableKeyErrorMessage: `The publishableKey passed to Clerk is invalid. You can get your Publishable key at https://dashboard.clerk.com/last-active?path=api-keys. (key={{key}})`,
  MissingPublishableKeyErrorMessage: `Missing publishableKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.`,
  MissingSecretKeyErrorMessage: `Missing secretKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.`,
  MissingClerkProvider: `{{source}} can only be used within the <ClerkProvider /> component. Learn more: https://clerk.com/docs/components/clerk-provider`
});
function buildErrorThrower({ packageName, customMessages }) {
  let pkg = packageName;
  function buildMessage(rawMessage, replacements) {
    if (!replacements) {
      return `${pkg}: ${rawMessage}`;
    }
    let msg = rawMessage;
    const matches = rawMessage.matchAll(/{{([a-zA-Z0-9-_]+)}}/g);
    for (const match of matches) {
      const replacement = (replacements[match[1]] || "").toString();
      msg = msg.replace(`{{${match[1]}}}`, replacement);
    }
    return `${pkg}: ${msg}`;
  }
  const messages = {
    ...DefaultMessages,
    ...customMessages
  };
  return {
    setPackageName({ packageName: packageName2 }) {
      if (typeof packageName2 === "string") {
        pkg = packageName2;
      }
      return this;
    },
    setMessages({ customMessages: customMessages2 }) {
      Object.assign(messages, customMessages2 || {});
      return this;
    },
    throwInvalidPublishableKeyError(params) {
      throw new Error(buildMessage(messages.InvalidPublishableKeyErrorMessage, params));
    },
    throwInvalidProxyUrl(params) {
      throw new Error(buildMessage(messages.InvalidProxyUrlErrorMessage, params));
    },
    throwMissingPublishableKeyError() {
      throw new Error(buildMessage(messages.MissingPublishableKeyErrorMessage));
    },
    throwMissingSecretKeyError() {
      throw new Error(buildMessage(messages.MissingSecretKeyErrorMessage));
    },
    throwMissingClerkProviderError(params) {
      throw new Error(buildMessage(messages.MissingClerkProvider, params));
    },
    throw(message) {
      throw new Error(buildMessage(message));
    }
  };
}

// src/errors/emailLinkError.ts
var EmailLinkError = class _EmailLinkError extends Error {
  code;
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "EmailLinkError";
    Object.setPrototypeOf(this, _EmailLinkError.prototype);
  }
};
var EmailLinkErrorCode = {
  Expired: "expired",
  Failed: "failed",
  ClientMismatch: "client_mismatch"
};
var EmailLinkErrorCodeStatus = {
  Expired: "expired",
  Failed: "failed",
  ClientMismatch: "client_mismatch"
};

// src/errors/clerkRuntimeError.ts
var ClerkRuntimeError = class _ClerkRuntimeError extends ClerkError {
  static kind = "ClerkRuntimeError";
  /**
   * @deprecated Use `clerkError` property instead. This property is maintained for backward compatibility.
   */
  clerkRuntimeError = true;
  constructor(message, options) {
    super({ ...options, message });
    Object.setPrototypeOf(this, _ClerkRuntimeError.prototype);
  }
};
var isClerkRuntimeError = createErrorTypeGuard(ClerkRuntimeError);

// src/errors/webAuthNError.ts
var ClerkWebAuthnError = class extends ClerkRuntimeError {
  /**
   * A unique code identifying the error, can be used for localization.
   */
  code;
  constructor(message, { code }) {
    super(message, { code });
    this.code = code;
  }
};

// src/errors/helpers.ts
function isUnauthorizedError(e) {
  const status = e?.status;
  const code = e?.errors?.[0]?.code;
  return code === "authentication_invalid" && status === 401;
}
function isCaptchaError(e) {
  return ["captcha_invalid", "captcha_not_enabled", "captcha_missing_token"].includes(e.errors[0].code);
}
function is4xxError(e) {
  const status = e?.status;
  return !!status && status >= 400 && status < 500;
}
function isNetworkError(e) {
  const message = (`${e.message}${e.name}` || "").toLowerCase().replace(/\s+/g, "");
  return message.includes("networkerror");
}
function isKnownError(error) {
  return isClerkAPIResponseError(error) || isMetamaskError(error) || isClerkRuntimeError2(error);
}
function isClerkAPIResponseError(err) {
  return err && "clerkError" in err;
}
function isClerkRuntimeError2(err) {
  return "clerkRuntimeError" in err;
}
function isReverificationCancelledError(err) {
  return isClerkRuntimeError2(err) && err.code === "reverification_cancelled";
}
function isMetamaskError(err) {
  return "code" in err && [4001, 32602, 32603].includes(err.code) && "message" in err;
}
function isUserLockedError(err) {
  return isClerkAPIResponseError(err) && err.errors?.[0]?.code === "user_locked";
}
function isPasswordPwnedError(err) {
  return isClerkAPIResponseError(err) && err.errors?.[0]?.code === "form_password_pwned";
}
function isEmailLinkError(err) {
  return err.name === "EmailLinkError";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ClerkAPIError,
  ClerkAPIResponseError,
  ClerkRuntimeError,
  ClerkWebAuthnError,
  EmailLinkError,
  EmailLinkErrorCode,
  EmailLinkErrorCodeStatus,
  buildErrorThrower,
  errorToJSON,
  is4xxError,
  isCaptchaError,
  isClerkAPIResponseError,
  isClerkRuntimeError,
  isEmailLinkError,
  isKnownError,
  isMetamaskError,
  isNetworkError,
  isPasswordPwnedError,
  isReverificationCancelledError,
  isUnauthorizedError,
  isUserLockedError,
  parseError,
  parseErrors
});
//# sourceMappingURL=error.js.map