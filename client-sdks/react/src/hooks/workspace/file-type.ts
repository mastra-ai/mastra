const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'avif', 'tiff', 'tif'];
const VIDEO_MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  ogv: 'video/ogg',
};

const extension = (path: string) => path.split('/').pop()?.split('.').pop()?.toLowerCase() ?? '';

export const isImageFile = (path: string, mimeType?: string) =>
  mimeType?.startsWith('image/') || IMAGE_EXTENSIONS.includes(extension(path));

export const isVideoFile = (path: string, mimeType?: string) =>
  mimeType?.startsWith('video/') || extension(path) in VIDEO_MIME_TYPES;

/** Media must be read as base64: reading it as utf-8 corrupts the bytes. */
export const isMediaFile = (path: string) => isImageFile(path) || isVideoFile(path);

export const videoMimeType = (path: string, mimeType?: string) =>
  mimeType?.startsWith('video/') ? mimeType : (VIDEO_MIME_TYPES[extension(path)] ?? 'video/mp4');

export const isMarkdownFile = (path: string) => /\.mdx?$/i.test(path);
