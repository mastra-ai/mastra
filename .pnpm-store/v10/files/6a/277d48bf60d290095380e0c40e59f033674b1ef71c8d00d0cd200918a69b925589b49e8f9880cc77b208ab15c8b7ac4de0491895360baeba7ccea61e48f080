import { CommandParser } from '../client/parser';
import { VerbatimStringReply } from '../RESP/types';
export interface ClientInfoReply {
    id: number;
    addr: string;
    /**
     * available since 6.2
     */
    laddr?: string;
    fd: number;
    name: string;
    age: number;
    idle: number;
    flags: string;
    db: number;
    sub: number;
    psub: number;
    /**
     * available since 7.0.3
     */
    ssub?: number;
    multi: number;
    qbuf: number;
    qbufFree: number;
    /**
     * available since 6.0
     */
    argvMem?: number;
    /**
     * available since 7.0
     */
    multiMem?: number;
    obl: number;
    oll: number;
    omem: number;
    /**
     * available since 6.0
     */
    totMem?: number;
    events: string;
    cmd: string;
    /**
     * available since 6.0
     */
    user?: string;
    /**
     * available since 6.2
     */
    redir?: number;
    /**
     * available since 7.0
     */
    resp?: number;
    /**
     * available since 7.0
     */
    libName?: string;
    /**
     * available since 7.0
     */
    libVer?: string;
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns information and statistics about the current client connection
     * @param parser - The Redis command parser
     */
    readonly parseCommand: (this: void, parser: CommandParser) => void;
    readonly transformReply: (this: void, rawReply: VerbatimStringReply) => ClientInfoReply;
};
export default _default;
//# sourceMappingURL=CLIENT_INFO.d.ts.map