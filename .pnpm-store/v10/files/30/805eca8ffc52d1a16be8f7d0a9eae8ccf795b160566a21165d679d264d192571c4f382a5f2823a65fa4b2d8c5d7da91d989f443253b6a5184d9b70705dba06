/**
 * Creates helper methods for dealing with a specific cookie.
 *
 * @example
 * ```ts
 * const cookie = createCookieHandler('my_cookie')
 *
 * cookie.set('my_value');
 * cookie.get() // 'my_value';
 * cookie.remove()
 * ```
 */
declare function createCookieHandler(cookieName: string): {
    get(): string | undefined;
    /**
     * Setting a cookie will use some defaults such as path being set to "/".
     */
    set(newValue: string, options?: Cookies.CookieAttributes): void;
    /**
     * On removing a cookie, you have to pass the exact same path/domain attributes used to set it initially
     * > IMPORTANT! When deleting a cookie and you're not relying on the default attributes, you must pass the exact same path, domain, secure and sameSite attributes that were used to set the cookie.
     *
     * @see https://github.com/js-cookie/js-cookie#basic-usage
     */
    remove(cookieAttributes?: Cookies.CookieAttributes): void;
};

export { createCookieHandler };
