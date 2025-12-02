import { AltNameMatch } from "./san";
export declare type Protocol = 'https1' | 'https2' | 'http1' | 'http2';
declare type AnySessionMap = {
    [key in Protocol]: unknown;
};
export interface OriginCacheEntry<P, Session> {
    protocol: P;
    session: Session;
    firstOrigin: string;
}
export default class OriginCache<SessionMap extends AnySessionMap> {
    private sessionMap;
    private staticMap;
    get<P extends Protocol>(protocol: P, origin: string): OriginCacheEntry<typeof protocol, SessionMap[P]> | undefined;
    set(origin: string, protocol: Protocol, session: SessionMap[typeof protocol], altNameMatch?: AltNameMatch, cleanup?: () => void): void;
    delete(session: SessionMap[keyof SessionMap]): boolean;
    disconnectAll(): void;
    disconnect(origin: string): void;
}
export {};
