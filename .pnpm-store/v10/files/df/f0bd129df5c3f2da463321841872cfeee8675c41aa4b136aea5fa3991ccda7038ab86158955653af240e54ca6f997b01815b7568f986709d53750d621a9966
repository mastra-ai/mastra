/// <reference types="node" />
import { PeerCertificate } from "tls";
export declare type AltNameMatcher = (name: string) => boolean;
export interface AltNameMatch {
    names: Array<string>;
    dynamic?: AltNameMatcher;
}
export declare function makeRegex(name: string): string;
export declare function parseOrigin(cert?: PeerCertificate): AltNameMatch;
