"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateClient = authenticateClient;
const zod_1 = require("zod");
const errors_js_1 = require("../errors.js");
const ClientAuthenticatedRequestSchema = zod_1.z.object({
    client_id: zod_1.z.string(),
    client_secret: zod_1.z.string().optional()
});
function authenticateClient({ clientsStore }) {
    return async (req, res, next) => {
        try {
            const result = ClientAuthenticatedRequestSchema.safeParse(req.body);
            if (!result.success) {
                throw new errors_js_1.InvalidRequestError(String(result.error));
            }
            const { client_id, client_secret } = result.data;
            const client = await clientsStore.getClient(client_id);
            if (!client) {
                throw new errors_js_1.InvalidClientError('Invalid client_id');
            }
            // If client has a secret, validate it
            if (client.client_secret) {
                // Check if client_secret is required but not provided
                if (!client_secret) {
                    throw new errors_js_1.InvalidClientError('Client secret is required');
                }
                // Check if client_secret matches
                if (client.client_secret !== client_secret) {
                    throw new errors_js_1.InvalidClientError('Invalid client_secret');
                }
                // Check if client_secret has expired
                if (client.client_secret_expires_at && client.client_secret_expires_at < Math.floor(Date.now() / 1000)) {
                    throw new errors_js_1.InvalidClientError('Client secret has expired');
                }
            }
            req.client = client;
            next();
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
    };
}
//# sourceMappingURL=clientAuth.js.map