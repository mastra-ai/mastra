"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CookieJar = void 0;
const tough_cookie_1 = require("tough-cookie");
class CookieJar {
    constructor(jar = new tough_cookie_1.CookieJar()) {
        this._jar = jar;
    }
    reset(jar = new tough_cookie_1.CookieJar()) {
        this._jar = jar;
    }
    setCookie(cookie, url) {
        return new Promise((resolve, reject) => {
            this._jar.setCookie(cookie, url, (err, cookie) => {
                if (err)
                    return reject(err);
                resolve(cookie);
            });
        });
    }
    setCookies(cookies, url) {
        return Promise.all(cookies.map(cookie => this.setCookie(cookie, url)));
    }
    getCookies(url) {
        return new Promise((resolve, reject) => {
            this._jar.getCookies(url, (err, cookies) => {
                if (err)
                    return reject(err);
                resolve(cookies);
            });
        });
    }
}
exports.CookieJar = CookieJar;
//# sourceMappingURL=cookie-jar.js.map