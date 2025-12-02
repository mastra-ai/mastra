import "./chunk-IEP6GGEX.mjs";

// src/cookie.ts
import Cookies from "js-cookie";
function createCookieHandler(cookieName) {
  return {
    get() {
      return Cookies.get(cookieName);
    },
    /**
     * Setting a cookie will use some defaults such as path being set to "/".
     */
    set(newValue, options = {}) {
      Cookies.set(cookieName, newValue, options);
    },
    /**
     * On removing a cookie, you have to pass the exact same path/domain attributes used to set it initially
     * > IMPORTANT! When deleting a cookie and you're not relying on the default attributes, you must pass the exact same path, domain, secure and sameSite attributes that were used to set the cookie.
     *
     * @see https://github.com/js-cookie/js-cookie#basic-usage
     */
    remove(cookieAttributes) {
      Cookies.remove(cookieName, cookieAttributes);
    }
  };
}
export {
  createCookieHandler
};
//# sourceMappingURL=cookie.mjs.map