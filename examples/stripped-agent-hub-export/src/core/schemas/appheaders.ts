import {z} from 'zod';

export const appHeadersSchema = z
  .object({
    authorization: z.string().optional(),
    'x-api-key': z.string().optional(),
    'x-correlation-id': z.string().optional(),
    'x-ims-org-id': z.string().optional(),
    'x-gw-ims-user-id': z.string().optional(),
    'x-gw-ims-token-type': z.string().optional(),
    'x-gw-ims-region': z.string().optional(),
  })
  .transform(data => {
    let imsToken: string | undefined;
    if (data.authorization?.startsWith('Bearer ') && data.authorization.length > 7) {
      imsToken = data.authorization.slice(7);
    }
    if (imsToken) {
      try {
        const decoded = Buffer.from(imsToken.split('.')[1], 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (!data['x-gw-ims-user-id']) {
          data['x-gw-ims-user-id'] = parsed.user_id;
        }
      } catch {
        // do nothing
      }
    }
    return {
      apiKey: data['x-api-key'],
      correlationId: data['x-correlation-id'],
      imsOrgId: data['x-ims-org-id'],
      imsUserId: data['x-gw-ims-user-id'],
      imsTokenType: data['x-gw-ims-token-type'],
      imsRegion: data['x-gw-ims-region'],
      imsToken,
    };
  });
