import { IOType } from 'node:child_process';
import { Stream } from 'node:stream';
import { z } from 'zod';

declare const JSONRPCMessageSchema: z.ZodUnion<[z.ZodObject<z.objectUtil.extendShape<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, {
    method: z.ZodString;
    params: z.ZodOptional<z.ZodObject<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}>, "strict", z.ZodTypeAny, {
    method: string;
    jsonrpc: "2.0";
    id: string | number;
    params?: z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}, {
    method: string;
    jsonrpc: "2.0";
    id: string | number;
    params?: z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}>, z.ZodObject<z.objectUtil.extendShape<{
    jsonrpc: z.ZodLiteral<"2.0">;
}, {
    method: z.ZodString;
    params: z.ZodOptional<z.ZodObject<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}>, "strict", z.ZodTypeAny, {
    method: string;
    jsonrpc: "2.0";
    params?: z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}, {
    method: string;
    jsonrpc: "2.0";
    params?: z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
}>, z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    result: z.ZodObject<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        _meta: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>;
}, "strict", z.ZodTypeAny, {
    result: {
        _meta?: z.objectOutputType<{}, z.ZodTypeAny, "passthrough"> | undefined;
    } & {
        [k: string]: unknown;
    };
    jsonrpc: "2.0";
    id: string | number;
}, {
    result: {
        _meta?: z.objectInputType<{}, z.ZodTypeAny, "passthrough"> | undefined;
    } & {
        [k: string]: unknown;
    };
    jsonrpc: "2.0";
    id: string | number;
}>, z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    error: z.ZodObject<{
        code: z.ZodNumber;
        message: z.ZodString;
        data: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        code: number;
        message: string;
        data?: unknown;
    }, {
        code: number;
        message: string;
        data?: unknown;
    }>;
}, "strict", z.ZodTypeAny, {
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
    jsonrpc: "2.0";
    id: string | number;
}, {
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
    jsonrpc: "2.0";
    id: string | number;
}>]>;
type JSONRPCMessage = z.infer<typeof JSONRPCMessageSchema>;

/**
 * Transport interface for MCP (Model Context Protocol) communication.
 * Maps to the `Transport` interface in the MCP spec.
 */
interface MCPTransport {
    /**
     * Initialize and start the transport
     */
    start(): Promise<void>;
    /**
     * Send a JSON-RPC message through the transport
     * @param message The JSON-RPC message to send
     */
    send(message: JSONRPCMessage): Promise<void>;
    /**
     * Clean up and close the transport
     */
    close(): Promise<void>;
    /**
     * Event handler for transport closure
     */
    onclose?: () => void;
    /**
     * Event handler for transport errors
     */
    onerror?: (error: Error) => void;
    /**
     * Event handler for received messages
     */
    onmessage?: (message: JSONRPCMessage) => void;
}

interface StdioConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    stderr?: IOType | Stream | number;
    cwd?: string;
}
declare class StdioMCPTransport implements MCPTransport {
    private process?;
    private abortController;
    private readBuffer;
    private serverParams;
    onclose?: () => void;
    onerror?: (error: unknown) => void;
    onmessage?: (message: JSONRPCMessage) => void;
    constructor(server: StdioConfig);
    start(): Promise<void>;
    private processReadBuffer;
    close(): Promise<void>;
    send(message: JSONRPCMessage): Promise<void>;
}

export { StdioMCPTransport as Experimental_StdioMCPTransport, StdioConfig };
