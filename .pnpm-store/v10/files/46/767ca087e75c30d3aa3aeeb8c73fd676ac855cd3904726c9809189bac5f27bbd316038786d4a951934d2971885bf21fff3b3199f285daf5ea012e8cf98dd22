"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizationHandler = authorizationHandler;
const zod_1 = require("zod");
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = require("express-rate-limit");
const allowedMethods_js_1 = require("../middleware/allowedMethods.js");
const errors_js_1 = require("../errors.js");
// Parameters that must be validated in order to issue redirects.
const ClientAuthorizationParamsSchema = zod_1.z.object({
    client_id: zod_1.z.string(),
    redirect_uri: zod_1.z
        .string()
        .optional()
        .refine(value => value === undefined || URL.canParse(value), { message: 'redirect_uri must be a valid URL' })
});
// Parameters that must be validated for a successful authorization request. Failure can be reported to the redirect URI.
const RequestAuthorizationParamsSchema = zod_1.z.object({
    response_type: zod_1.z.literal('code'),
    code_challenge: zod_1.z.string(),
    code_challenge_method: zod_1.z.literal('S256'),
    scope: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    resource: zod_1.z.string().url().optional()
});
function authorizationHandler({ provider, rateLimit: rateLimitConfig }) {
    // Create a router to apply middleware
    const router = express_1.default.Router();
    router.use((0, allowedMethods_js_1.allowedMethods)(['GET', 'POST']));
    router.use(express_1.default.urlencoded({ extended: false }));
    // Apply rate limiting unless explicitly disabled
    if (rateLimitConfig !== false) {
        router.use((0, express_rate_limit_1.rateLimit)({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // 100 requests per windowMs
            standardHeaders: true,
            legacyHeaders: false,
            message: new errors_js_1.TooManyRequestsError('You have exceeded the rate limit for authorization requests').toResponseObject(),
            ...rateLimitConfig
        }));
    }
    router.all('/', async (req, res) => {
        var _a;
        res.setHeader('Cache-Control', 'no-store');
        // In the authorization flow, errors are split into two categories:
        // 1. Pre-redirect errors (direct response with 400)
        // 2. Post-redirect errors (redirect with error parameters)
        // Phase 1: Validate client_id and redirect_uri. Any errors here must be direct responses.
        let client_id, redirect_uri, client;
        try {
            const result = ClientAuthorizationParamsSchema.safeParse(req.method === 'POST' ? req.body : req.query);
            if (!result.success) {
                throw new errors_js_1.InvalidRequestError(result.error.message);
            }
            client_id = result.data.client_id;
            redirect_uri = result.data.redirect_uri;
            client = await provider.clientsStore.getClient(client_id);
            if (!client) {
                throw new errors_js_1.InvalidClientError('Invalid client_id');
            }
            if (redirect_uri !== undefined) {
                if (!client.redirect_uris.includes(redirect_uri)) {
                    throw new errors_js_1.InvalidRequestError('Unregistered redirect_uri');
                }
            }
            else if (client.redirect_uris.length === 1) {
                redirect_uri = client.redirect_uris[0];
            }
            else {
                throw new errors_js_1.InvalidRequestError('redirect_uri must be specified when client has multiple registered URIs');
            }
        }
        catch (error) {
            // Pre-redirect errors - return direct response
            //
            // These don't need to be JSON encoded, as they'll be displayed in a user
            // agent, but OTOH they all represent exceptional situations (arguably,
            // "programmer error"), so presenting a nice HTML page doesn't help the
            // user anyway.
            if (error instanceof errors_js_1.OAuthError) {
                const status = error instanceof errors_js_1.ServerError ? 500 : 400;
                res.status(status).json(error.toResponseObject());
            }
            else {
                const serverError = new errors_js_1.ServerError('Internal Server Error');
                res.status(500).json(serverError.toResponseObject());
            }
            return;
        }
        // Phase 2: Validate other parameters. Any errors here should go into redirect responses.
        let state;
        try {
            // Parse and validate authorization parameters
            const parseResult = RequestAuthorizationParamsSchema.safeParse(req.method === 'POST' ? req.body : req.query);
            if (!parseResult.success) {
                throw new errors_js_1.InvalidRequestError(parseResult.error.message);
            }
            const { scope, code_challenge, resource } = parseResult.data;
            state = parseResult.data.state;
            // Validate scopes
            let requestedScopes = [];
            if (scope !== undefined) {
                requestedScopes = scope.split(' ');
                const allowedScopes = new Set((_a = client.scope) === null || _a === void 0 ? void 0 : _a.split(' '));
                // Check each requested scope against allowed scopes
                for (const scope of requestedScopes) {
                    if (!allowedScopes.has(scope)) {
                        throw new errors_js_1.InvalidScopeError(`Client was not registered with scope ${scope}`);
                    }
                }
            }
            // All validation passed, proceed with authorization
            await provider.authorize(client, {
                state,
                scopes: requestedScopes,
                redirectUri: redirect_uri,
                codeChallenge: code_challenge,
                resource: resource ? new URL(resource) : undefined
            }, res);
        }
        catch (error) {
            // Post-redirect errors - redirect with error parameters
            if (error instanceof errors_js_1.OAuthError) {
                res.redirect(302, createErrorRedirect(redirect_uri, error, state));
            }
            else {
                const serverError = new errors_js_1.ServerError('Internal Server Error');
                res.redirect(302, createErrorRedirect(redirect_uri, serverError, state));
            }
        }
    });
    return router;
}
/**
 * Helper function to create redirect URL with error parameters
 */
function createErrorRedirect(redirectUri, error, state) {
    const errorUrl = new URL(redirectUri);
    errorUrl.searchParams.set('error', error.errorCode);
    errorUrl.searchParams.set('error_description', error.message);
    if (error.errorUri) {
        errorUrl.searchParams.set('error_uri', error.errorUri);
    }
    if (state) {
        errorUrl.searchParams.set('state', state);
    }
    return errorUrl.href;
}
//# sourceMappingURL=authorize.js.map