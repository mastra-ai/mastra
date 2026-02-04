/**
 * Pattern to match content wrapped in <private> tags
 */
const PRIVATE_TAG_PATTERN = /<private>[\s\S]*?<\/private>/gi;

/**
 * Strip private content from a string
 * Content wrapped in <private> tags is replaced with [REDACTED]
 */
export function stripPrivateContent(content: string): string {
  return content.replace(PRIVATE_TAG_PATTERN, '[REDACTED]');
}

/**
 * Check if the entire content is private (only contains private tags)
 */
export function isFullyPrivate(content: string): boolean {
  const stripped = content.replace(PRIVATE_TAG_PATTERN, '').trim();
  return stripped.length === 0;
}
