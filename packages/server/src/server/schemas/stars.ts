import { z } from 'zod/v4';

/**
 * Response body for `PUT|DELETE /stored/{type}/:id/star` routes.
 */
export const starToggleResponseSchema = z.object({
  starred: z.boolean().describe('Whether the entity is currently starred by the caller'),
  starCount: z.number().int().nonnegative().describe('Total number of users who have starred this entity'),
});
