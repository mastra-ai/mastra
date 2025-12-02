/// <reference types="node" />
import { ClientRequest } from "http";
import { ClientHttp2Session } from "http2";
import { CookieJar } from "./cookie-jar";
import { HttpProtocols, Decoder, FetchInit } from "./core";
import { FetchExtra } from "./fetch-common";
import { Request } from "./request";
import { Response } from "./response";
export interface SimpleSession {
    protocol: HttpProtocols;
    cookieJar: CookieJar;
    userAgent(): string;
    accept(): string;
    contentDecoders(): ReadonlyArray<Decoder>;
    newFetch(input: string | Request, init?: Partial<FetchInit>, extra?: FetchExtra): Promise<Response>;
}
export interface SimpleSessionHttp1Request {
    req: ClientRequest;
    cleanup: () => void;
}
export interface SimpleSessionHttp2Session {
    session: Promise<ClientHttp2Session>;
    cleanup: () => void;
}
export interface SimpleSessionHttp1 extends SimpleSession {
    get(url: string): SimpleSessionHttp1Request;
}
export interface SimpleSessionHttp2 extends SimpleSession {
    get(): SimpleSessionHttp2Session;
}
