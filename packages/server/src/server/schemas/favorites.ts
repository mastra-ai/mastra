import { z } from 'zod/v4';

/**
 * Response body for `PUT|DELETE /stored/{type}/:id/favorite` routes.
 */
export const favoriteToggleResponseSchema = z.object({
  favorited: z.boolean().describe('Whether the entity is currently favorited by the caller'),
  favoriteCount: z.number().int().nonnegative().describe('Total number of users who have favorited this entity'),
});
