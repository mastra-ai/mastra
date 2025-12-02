// src/core.ts
import * as Iron from "iron-webcrypto";
import cookie from "cookie";
var timestampSkewSec = 60;
var fourteenDaysInSeconds = 15 * 24 * 3600;
var currentMajorVersion = 2;
var versionDelimiter = "~";
var defaultOptions = {
  ttl: fourteenDaysInSeconds,
  cookieOptions: {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/"
  }
};
function createGetIronSession(_crypto2, unsealData2, sealData2) {
  return async (req, res, userSessionOptions) => {
    if (!req || !res || !userSessionOptions || !userSessionOptions.cookieName || !userSessionOptions.password) {
      throw new Error(
        `iron-session: Bad usage. Minimum usage is const session = await getIronSession(req, res, { cookieName: "...", password: "...". Check the usage here: https://github.com/vvo/iron-session`
      );
    }
    const passwordsAsMap = normalizeStringPasswordToMap(
      userSessionOptions.password
    );
    Object.values(
      normalizeStringPasswordToMap(userSessionOptions.password)
    ).forEach((password) => {
      if (password.length < 32) {
        throw new Error(
          `iron-session: Bad usage. Password must be at least 32 characters long.`
        );
      }
    });
    const options = {
      ...defaultOptions,
      ...userSessionOptions,
      cookieOptions: {
        ...defaultOptions.cookieOptions,
        ...userSessionOptions.cookieOptions || {}
      }
    };
    if (options.ttl === 0) {
      options.ttl = 2147483647;
    }
    if (userSessionOptions.cookieOptions && "maxAge" in userSessionOptions.cookieOptions) {
      if (userSessionOptions.cookieOptions.maxAge === void 0) {
        options.ttl = 0;
      } else {
        options.cookieOptions.maxAge = computeCookieMaxAge(
          userSessionOptions.cookieOptions.maxAge
        );
      }
    } else {
      options.cookieOptions.maxAge = computeCookieMaxAge(options.ttl);
    }
    const sealFromCookies = cookie.parse(
      "credentials" in req ? req.headers.get("cookie") || "" : req.headers.cookie || ""
    )[options.cookieName];
    const session = sealFromCookies === void 0 ? {} : await unsealData2(sealFromCookies, {
      password: passwordsAsMap,
      ttl: options.ttl
    });
    Object.defineProperties(session, {
      save: {
        value: async function save() {
          if ("headersSent" in res && res.headersSent === true) {
            throw new Error(
              `iron-session: Cannot set session cookie: session.save() was called after headers were sent. Make sure to call it before any res.send() or res.end()`
            );
          }
          const seal2 = await sealData2(session, {
            password: passwordsAsMap,
            ttl: options.ttl
          });
          const cookieValue = cookie.serialize(
            options.cookieName,
            seal2,
            options.cookieOptions
          );
          if (cookieValue.length > 4096) {
            throw new Error(
              `iron-session: Cookie length is too big ${cookieValue.length}, browsers will refuse it. Try to remove some data.`
            );
          }
          addToCookies(cookieValue, res);
        }
      },
      destroy: {
        value: function destroy() {
          Object.keys(session).forEach((key) => {
            delete session[key];
          });
          const cookieValue = cookie.serialize(options.cookieName, "", {
            ...options.cookieOptions,
            maxAge: 0
          });
          addToCookies(cookieValue, res);
        }
      }
    });
    return session;
  };
}
function addToCookies(cookieValue, res) {
  var _a;
  if ("headers" in res) {
    res.headers.append("set-cookie", cookieValue);
    return;
  }
  let existingSetCookie = (_a = res.getHeader("set-cookie")) != null ? _a : [];
  if (typeof existingSetCookie === "string") {
    existingSetCookie = [existingSetCookie];
  }
  res.setHeader("set-cookie", [...existingSetCookie, cookieValue]);
}
function computeCookieMaxAge(ttl) {
  return ttl - timestampSkewSec;
}
function createUnsealData(_crypto2) {
  return async (seal2, {
    password,
    ttl = fourteenDaysInSeconds
  }) => {
    const passwordsAsMap = normalizeStringPasswordToMap(password);
    const { sealWithoutVersion, tokenVersion } = parseSeal(seal2);
    try {
      const data = await Iron.unseal(_crypto2, sealWithoutVersion, passwordsAsMap, {
        ...Iron.defaults,
        ttl: ttl * 1e3
      }) || {};
      if (tokenVersion === 2) {
        return data;
      }
      return {
        ...data.persistent
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Expired seal" || error.message === "Bad hmac value" || error.message.startsWith("Cannot find password: ") || error.message === "Incorrect number of sealed components") {
          return {};
        }
      }
      throw error;
    }
  };
}
function parseSeal(seal2) {
  if (seal2[seal2.length - 2] === versionDelimiter) {
    const [sealWithoutVersion, tokenVersionAsString] = seal2.split(versionDelimiter);
    return {
      sealWithoutVersion,
      tokenVersion: parseInt(tokenVersionAsString, 10)
    };
  }
  return { sealWithoutVersion: seal2, tokenVersion: null };
}
function createSealData(_crypto2) {
  return async (data, {
    password,
    ttl = fourteenDaysInSeconds
  }) => {
    const passwordsAsMap = normalizeStringPasswordToMap(password);
    const mostRecentPasswordId = Math.max(
      ...Object.keys(passwordsAsMap).map((id) => parseInt(id, 10))
    );
    const passwordForSeal = {
      id: mostRecentPasswordId.toString(),
      secret: passwordsAsMap[mostRecentPasswordId]
    };
    const seal2 = await Iron.seal(_crypto2, data, passwordForSeal, {
      ...Iron.defaults,
      ttl: ttl * 1e3
    });
    return `${seal2}${versionDelimiter}${currentMajorVersion}`;
  };
}
function normalizeStringPasswordToMap(password) {
  return typeof password === "string" ? { 1: password } : password;
}

// src/index.ts
import { Crypto } from "@peculiar/webcrypto";
var _crypto = new Crypto();
var unsealData = createUnsealData(_crypto);
var sealData = createSealData(_crypto);
var getIronSession = createGetIronSession(
  _crypto,
  unsealData,
  sealData
);
export {
  createGetIronSession,
  createSealData,
  createUnsealData,
  getIronSession,
  sealData,
  unsealData
};
//# sourceMappingURL=index.mjs.map