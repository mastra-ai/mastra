interface RequestControllerSource {
    passthrough(): void;
    respondWith(response: Response): void;
    errorWith(reason?: unknown): void;
}
declare class RequestController {
    #private;
    protected readonly request: Request;
    protected readonly source: RequestControllerSource;
    static PENDING: 0;
    static PASSTHROUGH: 1;
    static RESPONSE: 2;
    static ERROR: 3;
    readyState: number;
    /**
     * A Promise that resolves when this controller handles a request.
     * See `controller.readyState` for more information on the handling result.
     */
    handled: Promise<void>;
    constructor(request: Request, source: RequestControllerSource);
    /**
     * Perform this request as-is.
     */
    passthrough(): Promise<void>;
    /**
     * Respond to this request with the given `Response` instance.
     *
     * @example
     * controller.respondWith(new Response())
     * controller.respondWith(Response.json({ id }))
     * controller.respondWith(Response.error())
     */
    respondWith(response: Response): void;
    /**
     * Error this request with the given reason.
     *
     * @example
     * controller.errorWith()
     * controller.errorWith(new Error('Oops!'))
     * controller.errorWith({ message: 'Oops!'})
     */
    errorWith(reason?: unknown): void;
}

declare const IS_PATCHED_MODULE: unique symbol;

type RequestCredentials = 'omit' | 'include' | 'same-origin';
type HttpRequestEventMap = {
    request: [
        args: {
            request: Request;
            requestId: string;
            controller: RequestController;
        }
    ];
    response: [
        args: {
            response: Response;
            isMockedResponse: boolean;
            request: Request;
            requestId: string;
        }
    ];
    unhandledException: [
        args: {
            error: unknown;
            request: Request;
            requestId: string;
            controller: RequestController;
        }
    ];
};

export { HttpRequestEventMap as H, IS_PATCHED_MODULE as I, RequestController as R, RequestControllerSource as a, RequestCredentials as b };
