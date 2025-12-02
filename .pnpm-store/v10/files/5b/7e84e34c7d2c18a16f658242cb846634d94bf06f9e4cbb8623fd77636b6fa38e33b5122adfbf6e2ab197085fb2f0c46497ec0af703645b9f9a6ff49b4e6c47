import * as iron_session from 'iron-session';
export { IronSessionData, IronSessionOptions } from 'iron-session';
import * as http from 'http';

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
declare const getIronSession: (req: http.IncomingMessage | Request, res: http.ServerResponse | Response, userSessionOptions: iron_session.IronSessionOptions) => Promise<iron_session.IronSession>;

export { getIronSession, sealData, unsealData };
