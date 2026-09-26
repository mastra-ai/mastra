/** Whether a MIME type represents content that cannot be safely stored as UTF-8 text. */
export function isBinaryMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  if (mimeType.startsWith('text/')) return false;
  if (mimeType === 'application/json') return false;
  if (mimeType === 'image/svg+xml') return false;
  return true;
}
