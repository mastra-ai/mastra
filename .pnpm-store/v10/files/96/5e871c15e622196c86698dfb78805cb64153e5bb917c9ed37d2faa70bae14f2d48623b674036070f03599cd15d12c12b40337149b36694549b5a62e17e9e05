import { Cookie, CookieJar as ToughCookieJar } from "tough-cookie";
export declare class CookieJar {
    private _jar;
    constructor(jar?: ToughCookieJar);
    reset(jar?: ToughCookieJar): void;
    setCookie(cookie: string | Cookie, url: string): Promise<Cookie>;
    setCookies(cookies: ReadonlyArray<string | Cookie>, url: string): Promise<ReadonlyArray<Cookie>>;
    getCookies(url: string): Promise<ReadonlyArray<Cookie>>;
}
