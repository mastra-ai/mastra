import { z } from 'zod';

import { HttpBoundaryError } from './http-errors.js';

const reviewCursorSchema = z.tuple([z.iso.datetime({ offset: true }), z.string().min(1).max(128)]);

export const encodeReviewCursor = (createdAt: string, reviewId: string): string =>
  Buffer.from(JSON.stringify(reviewCursorSchema.parse([createdAt, reviewId]))).toString('base64url');

export const decodeReviewCursor = (
  cursor: string | undefined,
): Readonly<{ afterCreatedAt?: string; afterReviewId?: string }> => {
  if (cursor === undefined) return {};
  try {
    const [afterCreatedAt, afterReviewId] = reviewCursorSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    return { afterCreatedAt, afterReviewId };
  } catch {
    throw new HttpBoundaryError('INVALID_CURSOR', 'The review cursor is invalid', 400);
  }
};
