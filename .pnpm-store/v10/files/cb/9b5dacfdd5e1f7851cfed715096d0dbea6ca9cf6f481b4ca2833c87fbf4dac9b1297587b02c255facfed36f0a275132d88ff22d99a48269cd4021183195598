"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenHandler = tokenHandler;
const zod_1 = require("zod");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const pkce_challenge_1 = require("pkce-challenge");
const clientAuth_js_1 = require("../middleware/clientAuth.js");
const express_rate_limit_1 = require("express-rate-limit");
const allowedMethods_js_1 = require("../middleware/allowedMethods.js");
const errors_js_1 = require("../errors.js");
const TokenRequestSchema = zod_1.z.object({
    grant_type: zod_1.z.string()
});
const AuthorizationCodeGrantSchema = zod_1.z.object({
    code: zod_1.z.string(),
    code_verifier: zod_1.z.string(),
    redirect_uri: zod_1.z.string().optional(),
    resource: zod_1.z.string().url().optional()
});
const RefreshTokenGrantSchema = zod_1.z.object({
    refresh_token: zod_1.z.string(),
    scope: zod_1.z.string().optional(),
    resource: zod_1.z.string().url().optional()
});
function tokenHandler({ provider, rateLimit: rateLimitConfig }) {
    // Nested router so we can configure middleware and restrict HTTP method
    const router = express_1.default.Router();
    // Configure CORS to allow any origin, to make accessible to web-based MCP clients
    router.use((0, cors_1.default)());
    router.use((0, allowedMethods_js_1.allowedMethods)(['POST']));
    router.use(express_1.default.urlencoded({ extended: false }));
    // Apply rate limiting unless explicitly disabled
    if (rateLimitConfig !== false) {
        router.use((0, express_rate_limit_1.rateLimit)({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 50, // 50 requests per windowMs
            standardHeaders: true,
            legacyHeaders: false,
            message: new errors_js_1.TooManyRequestsError('You have exceeded the rate limit for token requests').toResponseObject(),
            ...rateLimitConfig
        }));
    }
    // Authenticate and extract client details
    router.use((0, clientAuth_js_1.authenticateClient)({ clientsStore: provider.clientsStore }));
    router.post('/', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        try {
            const parseResult = TokenRequestSchema.safeParse(req.body);
            if (!parseResult.success) {
                throw new errors_js_1.InvalidRequestError(parseResult.error.message);
            }
            const { grant_type } = parseResult.data;
            const client = req.client;
            if (!client) {
                // This should never happen
                throw new errors_js_1.ServerError('Internal Server Error');
            }
            switch (grant_type) {
                case 'authorization_code': {
                    const parseResult = AuthorizationCodeGrantSchema.safeParse(req.body);
                    if (!parseResult.success) {
                        throw new errors_js_1.InvalidRequestError(parseResult.error.message);
                    }
                    const { code, code_verifier, redirect_uri, resource } = parseResult.data;
                    const skipLocalPkceValidation = provider.skipLocalPkceValidation;
                    // Perform local PKCE validation unless explicitly skipped
                    // (e.g. to validate code_verifier in upstream server)
                    if (!skipLocalPkceValidation) {
                        const codeChallenge = await provider.challengeForAuthorizationCode(client, code);
                        if (!(await (0, pkce_challenge_1.verifyChallenge)(code_verifier, codeChallenge))) {
                            throw new errors_js_1.InvalidGrantError('code_verifier does not match the challenge');
                        }
                    }
                    // Passes the code_verifier to the provider if PKCE validation didn't occur locally
                    const tokens = await provider.exchangeAuthorizationCode(client, code, skipLocalPkceValidation ? code_verifier : undefined, redirect_uri, resource ? new URL(resource) : undefined);
                    res.status(200).json(tokens);
                    break;
                }
                case 'refresh_token': {
                    const parseResult = RefreshTokenGrantSchema.safeParse(req.body);
                    if (!parseResult.success) {
                        throw new errors_js_1.InvalidRequestError(parseResult.error.message);
                    }
                    const { refresh_token, scope, resource } = parseResult.data;
                    const scopes = scope === null || scope === void 0 ? void 0 : scope.split(' ');
                    const tokens = await provider.exchangeRefreshToken(client, refresh_token, scopes, resource ? new URL(resource) : undefined);
                    res.status(200).json(tokens);
                    break;
                }
                // Not supported right now
                //case "client_credentials":
                default:
                    throw new errors_js_1.UnsupportedGrantTypeError('The grant type is not supported by this authorization server.');
            }
        }
        catch (error) {
            if (error instanceof errors_js_1.OAuthError) {
                const status = error instanceof errors_js_1.ServerError ? 500 : 400;
                res.status(status).json(error.toResponseObject());
            }
            else {
                const serverError = new errors_js_1.ServerError('Internal Server Error');
                res.status(500).json(serverError.toResponseObject());
            }
        }
    });
    return router;
}
//# sourceMappingURL=token.js.map