import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Trace extends APIResource {
    /**
     * Get email trace
     *
     * @example
     * ```ts
     * const trace =
     *   await client.emailSecurity.investigate.trace.get(
     *     '4Njp3P0STMz2c02Q',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(postfixId: string, params: TraceGetParams, options?: Core.RequestOptions): Core.APIPromise<TraceGetResponse>;
}
export interface TraceGetResponse {
    inbound: TraceGetResponse.Inbound;
    outbound: TraceGetResponse.Outbound;
}
export declare namespace TraceGetResponse {
    interface Inbound {
        lines?: Array<Inbound.Line> | null;
    }
    namespace Inbound {
        interface Line {
            lineno: number;
            message: string;
            ts: string;
        }
    }
    interface Outbound {
        lines?: Array<Outbound.Line> | null;
    }
    namespace Outbound {
        interface Line {
            lineno: number;
            message: string;
            ts: string;
        }
    }
}
export interface TraceGetParams {
    /**
     * Account Identifier
     */
    account_id: string;
}
export declare namespace Trace {
    export { type TraceGetResponse as TraceGetResponse, type TraceGetParams as TraceGetParams };
}
//# sourceMappingURL=trace.d.ts.map