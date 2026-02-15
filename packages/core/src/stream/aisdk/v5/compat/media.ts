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

// Magic-byte detection for container formats (EBML, ISO BMFF) is inherently limited:
// - EBML prefix 0x1A45DFA3 is shared by video/webm, audio/webm, and video/x-matroska.
//   Callers should prefer an explicit mediaType when the container type is known.
// - ISO BMFF (MP4) entries only cover common ftyp box sizes (0x18, 0x1c, 0x20) and
//   brands (isom, mp41, mp42, qt, 3gp4, 3gp5). Files with other sizes or brands
//   (e.g., 0x14, 0x24, 'dash', 'M4V ', 'avc1') won't be auto-detected.
//   Provide an explicit mediaType for broader coverage.
export const videoMediaTypeSignatures = [
  {
    mediaType: 'video/webm' as const,
    bytesPrefix: [0x1a, 0x45, 0xdf, 0xa3],
    base64Prefix: 'GkXf',
  },
  {
    mediaType: 'video/x-flv' as const,
    bytesPrefix: [0x46, 0x4c, 0x56, 0x01],
    base64Prefix: 'RkxW',
  },
  {
    mediaType: 'video/mpeg' as const,
    bytesPrefix: [0x00, 0x00, 0x01, 0xba],
    base64Prefix: 'AAABug',
  },
  {
    mediaType: 'video/mp4' as const,
    bytesPrefix: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d],
    base64Prefix: 'AAAAGGZ0eXBpc29t',
  },
  {
    mediaType: 'video/mp4' as const,
    bytesPrefix: [0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d],
    base64Prefix: 'AAAAHGZ0eXBpc29t',
  },
  {
    mediaType: 'video/mp4' as const,
    bytesPrefix: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d],
    base64Prefix: 'AAAAIGZ0eXBpc29t',
  },
  {
    mediaType: 'video/mp4' as const,
    bytesPrefix: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x31],
    base64Prefix: 'AAAAIGZ0eXBtcDQx',
  },
  {
    mediaType: 'video/mp4' as const,
    bytesPrefix: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32],
    base64Prefix: 'AAAAIGZ0eXBtcDQy',
  },
  {
    mediaType: 'video/quicktime' as const,
    bytesPrefix: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20],
    base64Prefix: 'AAAAIGZ0eXBxdCAg',
  },
  {
    mediaType: 'video/3gpp' as const,
    bytesPrefix: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x33, 0x67, 0x70, 0x34],
    base64Prefix: 'AAAAIGZ0eXAzZ3A0',
  },
  {
    mediaType: 'video/3gpp' as const,
    bytesPrefix: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x33, 0x67, 0x70, 0x35],
    base64Prefix: 'AAAAIGZ0eXAzZ3A1',
  },
] as const;

const stripID3 = (data: Uint8Array | string) => {
  const bytes = typeof data === 'string' ? convertBase64ToUint8Array(data) : data;
  const id3Size =
    // @ts-expect-error - bytes array access
    ((bytes[6] & 0x7f) << 21) |
    // @ts-expect-error - bytes array access
    ((bytes[7] & 0x7f) << 14) |
    // @ts-expect-error - bytes array access
    ((bytes[8] & 0x7f) << 7) |
    // @ts-expect-error - bytes array access
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
  signatures: typeof audioMediaTypeSignatures | typeof imageMediaTypeSignatures | typeof videoMediaTypeSignatures;
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
