/** Target pixel size for avatar images (square). */
const AVATAR_SIZE = 256;

/** Maximum decoded byte size for the final avatar. */
const AVATAR_MAX_BYTES = 512 * 1024;

/** JPEG quality for non-PNG sources. */
const JPEG_QUALITY = 0.85;

export interface DownscaledAvatar {
  /** Data URL ready to store in metadata.avatarUrl */
  dataUrl: string;
  /** MIME content type used for encoding */
  contentType: 'image/png' | 'image/jpeg';
}

/**
 * Estimate the decoded byte length of a base64 data URL.
 * Does not allocate a full buffer — uses the 3/4 ratio.
 */
export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return 0;
  const base64 = dataUrl.slice(commaIdx + 1);
  const padding = (base64.match(/=+$/) ?? [''])[0]!.length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Downscales an image file to a 256×256 center-cropped square and returns it
 * as a data URL. Preserves PNG for PNG sources; everything else becomes JPEG.
 *
 * Throws if the result exceeds 512 KB after encoding (unlikely at 256×256, but
 * guards against pathological inputs).
 */
export async function downscaleImageToDataUrl(file: File): Promise<DownscaledAvatar> {
  const bitmap = await createImageBitmap(file);

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  // Center-crop to a square region from the source
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  const contentType: 'image/png' | 'image/jpeg' = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(contentType, JPEG_QUALITY);

  // Validate size
  const decodedSize = estimateDataUrlBytes(dataUrl);
  if (decodedSize > AVATAR_MAX_BYTES) {
    throw new Error(
      `Avatar is too large after downscaling (${Math.round(decodedSize / 1024)} KB). Try a smaller image.`,
    );
  }

  return { dataUrl, contentType };
}
