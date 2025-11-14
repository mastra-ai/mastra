import { HTTPException } from '../http-exception';

// Validation helper
export function validateBody(body: Record<string, unknown>) {
  const errorResponse = Object.entries(body).reduce<Record<string, string>>((acc, [key, value]) => {
    if (!value) {
      acc[key] = `Argument "${key}" is required`;
    }
    return acc;
  }, {});

  if (Object.keys(errorResponse).length > 0) {
    throw new HTTPException(400, { message: Object.values(errorResponse)[0] });
  }
}

/**
 * sanitizes the body by removing disallowed keys.
 * @param body body to sanitize
 * @param disallowedKeys keys to remove from the body
 */
export function sanitizeBody(body: Record<string, unknown>, disallowedKeys: string[]) {
  for (const key of disallowedKeys) {
    if (key in body) {
      delete body[key];
    }
  }
}
