import type * as http from 'node:http';
import { PostHogBackendClient } from '../client';
type ExpressMiddleware = (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void;
type ExpressErrorMiddleware = (error: MiddlewareError, req: http.IncomingMessage, res: http.ServerResponse, next: (error: MiddlewareError) => void) => void;
interface MiddlewareError extends Error {
    status?: number | string;
    statusCode?: number | string;
    status_code?: number | string;
    output?: {
        statusCode?: number | string;
    };
}
export declare function setupExpressErrorHandler(_posthog: PostHogBackendClient, app: {
    use: (middleware: ExpressMiddleware | ExpressErrorMiddleware) => unknown;
}): void;
export {};
//# sourceMappingURL=express.d.ts.map