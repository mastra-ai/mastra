import { PostHogBackendClient } from '../../client';
import { EventMessage, PostHogOptions } from '../../types';
import type { Logger } from '@posthog/core';
import { ErrorTracking as CoreErrorTracking } from '@posthog/core';
export default class ErrorTracking {
    private client;
    private _exceptionAutocaptureEnabled;
    private _rateLimiter;
    private _logger;
    static errorPropertiesBuilder: CoreErrorTracking.ErrorPropertiesBuilder;
    constructor(client: PostHogBackendClient, options: PostHogOptions, _logger: Logger);
    static buildEventMessage(error: unknown, hint: CoreErrorTracking.EventHint, distinctId?: string, additionalProperties?: Record<string | number, any>): Promise<EventMessage>;
    private startAutocaptureIfEnabled;
    private onException;
    private onFatalError;
    isEnabled(): boolean;
    shutdown(): void;
}
//# sourceMappingURL=index.d.ts.map