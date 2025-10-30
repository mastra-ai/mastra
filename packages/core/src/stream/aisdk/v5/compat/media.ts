import { convertBase64ToUint8Array } from '@ai-sdk/provider-utils-v5';

export const imageMediaTypeSignatures = [
  {
    mediaType: 'image/gif' as const,
    bytesPrefix: [0x47, 0x49, 0x46],
    base64Prefix: 'R0lG',
  },
  {
    mediaType: 'image/png' as const,
    bytesPrefix: [0x89, 0x50, 0x4e, 0x47],
    base64Prefix: 'iVBORw',
  },
  {
    mediaType: 'image/jpeg' as const,
    bytesPrefix: [0xff, 0xd8],
    base64Prefix: '/9j/',
  },
  {
    mediaType: 'image/webp' as const,
    bytesPrefix: [0x52, 0x49, 0x46, 0x46],
    base64Prefix: 'UklGRg',
  },
  {
    mediaType: 'image/bmp' as const,
    bytesPrefix: [0x42, 0x4d],
    base64Prefix: 'Qk',
  },
  {
    mediaType: 'image/tiff' as const,
    bytesPrefix: [0x49, 0x49, 0x2a, 0x00],
    base64Prefix: 'SUkqAA',
  },
  {
    mediaType: 'image/tiff' as const,
    bytesPrefix: [0x4d, 0x4d, 0x00, 0x2a],
    base64Prefix: 'TU0AKg',
  },
  {
    mediaType: 'image/avif' as const,
    bytesPrefix: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66],
    base64Prefix: 'AAAAIGZ0eXBhdmlm',
  },
  {
    mediaType: 'image/heic' as const,
    bytesPrefix: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63],
    base64Prefix: 'AAAAIGZ0eXBoZWlj',
  },
] as const;

export const audioMediaTypeSignatures = [
  {
    mediaType: 'audio/mpeg' as const,
    bytesPrefix: [0xff, 0xfb],
    base64Prefix: '//s=',
  },
  {
    mediaType: 'audio/mpeg' as const,
    bytesPrefix: [0xff, 0xfa],
    base64Prefix: '//o=',
  },
  {
    mediaType: 'audio/mpeg' as const,
    bytesPrefix: [0xff, 0xf3],
    base64Prefix: '//M=',
  },
  {
    mediaType: 'audio/mpeg' as const,
    bytesPrefix: [0xff, 0xf2],
    base64Prefix: '//I=',
  },
  {
    mediaType: 'audio/mpeg' as const,
    bytesPrefix: [0xff, 0xe3],
    base64Prefix: '/+M=',
  },
  {
    mediaType: 'audio/mpeg' as const,
    bytesPrefix: [0xff, 0xe2],
    base64Prefix: '/+I=',
  },
  {
    mediaType: 'audio/wav' as const,
    bytesPrefix: [0x52, 0x49, 0x46, 0x46],
    base64Prefix: 'UklGR',
  },
  {
    mediaType: 'audio/ogg' as const,
    bytesPrefix: [0x4f, 0x67, 0x67, 0x53],
    base64Prefix: 'T2dnUw',
  },
  {
    mediaType: 'audio/flac' as const,
    bytesPrefix: [0x66, 0x4c, 0x61, 0x43],
    base64Prefix: 'ZkxhQw',
  },
  {
    mediaType: 'audio/aac' as const,
    bytesPrefix: [0x40, 0x15, 0x00, 0x00],
    base64Prefix: 'QBUA',
  },
  {
    mediaType: 'audio/mp4' as const,
    bytesPrefix: [0x66, 0x74, 0x79, 0x70],
    base64Prefix: 'ZnR5cA',
  },
  {
    mediaType: 'audio/webm',
    bytesPrefix: [0x1a, 0x45, 0xdf, 0xa3],
    base64Prefix: 'GkXf',
  },
] as const;

const stripID3 = (data: Uint8Array | string) => {
  const bytes = typeof data === 'string' ? convertBase64ToUint8Array(data) : data;
  const id3Size =
    // @ts-ignore
    ((bytes[6] & 0x7f) << 21) |
    // @ts-ignore
    ((bytes[7] & 0x7f) << 14) |
    // @ts-ignore
    ((bytes[8] & 0x7f) << 7) |
    // @ts-ignore
    (bytes[9] & 0x7f);

  // The raw MP3 starts here
  return bytes.slice(id3Size + 10);
};

function stripID3TagsIfPresent(data: Uint8Array | string): Uint8Array | string {
  const hasId3 =
    (typeof data === 'string' && data.startsWith('SUQz')) ||
    (typeof data !== 'string' &&
      data.length > 10 &&
      data[0] === 0x49 && // 'I'
      data[1] === 0x44 && // 'D'
      data[2] === 0x33); // '3'

  return hasId3 ? stripID3(data) : data;
}

export function detectMediaType({
  data,
  signatures,
}: {
  data: Uint8Array | string;
  signatures: typeof audioMediaTypeSignatures | typeof imageMediaTypeSignatures;
}): (typeof signatures)[number]['mediaType'] | undefined {
  const processedData = stripID3TagsIfPresent(data);

  for (const signature of signatures) {
    if (
      typeof processedData === 'string'
        ? processedData.startsWith(signature.base64Prefix)
        : processedData.length >= signature.bytesPrefix.length &&
          signature.bytesPrefix.every((byte, index) => processedData[index] === byte)
    ) {
      return signature.mediaType;
    }
  }

  return undefined;
}
