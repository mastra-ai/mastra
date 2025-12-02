import { z } from 'zod';
import { InvalidRequestError, InvalidClientError, ServerError, OAuthError } from '../errors.js';
const ClientAuthenticatedRequestSchema = z.object({
    client_id: z.string(),
    client_secret: z.string().optional()
});
export function authenticateClient({ clientsStore }) {
    return async (req, res, next) => {
        try {
            const result = ClientAuthenticatedRequestSchema.safeParse(req.body);
            if (!result.success) {
                throw new InvalidRequestError(String(result.error));
            }
            const { client_id, client_secret } = result.data;
            const client = await clientsStore.getClient(client_id);
            if (!client) {
                throw new InvalidClientError('Invalid client_id');
            }
            // If client has a secret, validate it
            if (client.client_secret) {
                // Check if client_secret is required but not provided
                if (!client_secret) {
                    throw new InvalidClientError('Client secret is required');
                }
                // Check if client_secret matches
                if (client.client_secret !== client_secret) {
                    throw new InvalidClientError('Invalid client_secret');
                }
                // Check if client_secret has expired
                if (client.client_secret_expires_at && client.client_secret_expires_at < Math.floor(Date.now() / 1000)) {
                    throw new InvalidClientError('Client secret has expired');
                }
            }
            req.client = client;
            next();
        }
        catch (error) {
            if (error instanceof OAuthError) {
                const status = error instanceof ServerError ? 500 : 400;
                res.status(status).json(error.toResponseObject());
            }
            else {
                const serverError = new ServerError('Internal Server Error');
                res.status(500).json(serverError.toResponseObject());
            }
        }
    };
}
//# sourceMappingURL=clientAuth.js.map