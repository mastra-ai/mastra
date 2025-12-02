import { CookieSerializeOptions } from 'cookie';
import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';

declare type passwordsMap = {
    [id: string]: string;
};
declare type password = string | passwordsMap;
interface IronSessionOptions {
    /**
     * This is the cookie name that will be used inside the browser. You should make sure it's unique given
     * your application. Example: vercel-session
     */
    cookieName: string;
    /**
     * This is the password(s) that will be used to encrypt the cookie. It can be either a string or an object
     * like {1: "password", 2: password}.
     *
     * When you provide multiple passwords then all of them will be used to decrypt the cookie and only the most
     * recent (= highest key, 2 in this example) password will be used to encrypt the cookie. This allow you
     * to use password rotation (security)
     */
    password: password;
    /**
     * This is the time in seconds that the session will be valid for. This also set the max-age attribute of
     * the cookie automatically (minus 60 seconds so that the cookie always expire before the session).
     */
    ttl?: number;
    /**
     * This is the options that will be passed to the cookie library.
     * You can see all of them here: https://github.com/jshttp/cookie#options-1.
     *
     * If you want to use "session cookies" (cookies that are deleted when the browser is closed) then you need
     * to pass cookieOptions: { maxAge: undefined }.
     */
    cookieOptions?: CookieSerializeOptions;
}
interface IronSessionData {
}
declare type IronSession = IronSessionData & {
    /**
     * Destroys the session data and removes the cookie.
     */
    destroy: () => void;
    /**
     * Encrypts the session data and sets the cookie.
     */
    save: () => Promise<void>;
};
declare module "http" {
    interface IncomingMessage {
        session: IronSession;
    }
}
declare type RequestType = IncomingMessage | Request;
declare type ResponseType = ServerResponse | Response;
declare function createGetIronSession(_crypto: Crypto, unsealData: ReturnType<typeof createUnsealData>, sealData: ReturnType<typeof createSealData>): (req: RequestType, res: ResponseType, userSessionOptions: IronSessionOptions) => Promise<IronSession>;
declare function createUnsealData(_crypto: Crypto): <T = Record<string, unknown>>(seal: string, { password, ttl, }: {
    password: password;
    ttl?: number | undefined;
}) => Promise<T>;
declare function createSealData(_crypto: Crypto): (data: unknown, { password, ttl, }: {
    password: password;
    ttl?: number | undefined;
}) => Promise<string>;

declare const unsealData: <T = Record<string, unknown>>(seal: string, { password, ttl, }: {
    password: string | {
        [id: string]: string;
    };
    ttl?: number | undefined;
}) => Promise<T>;
declare const sealData: (data: unknown, { password, ttl, }: {
    password: string | {
        [id: string]: string;
    };
    ttl?: number | undefined;
}) => Promise<string>;
declare const getIronSession: (req: http.IncomingMessage | Request, res: http.ServerResponse | Response, userSessionOptions: IronSessionOptions) => Promise<IronSession>;

export { IronSession, IronSessionData, IronSessionOptions, createGetIronSession, createSealData, createUnsealData, getIronSession, sealData, unsealData };
