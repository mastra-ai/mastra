export const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

export function convertSignalDataToBase64String(content: string | ArrayBuffer | Uint8Array): string {
  if (typeof content === 'string') {
    return content;
  }

  const bytes = content instanceof ArrayBuffer ? new Uint8Array(content) : content;
  return uint8ArrayToBase64(bytes);
}

/** Canonical DB `file` part `data` for optimistic UI and memory-shaped storage. */
export function encodeFilePartDataForStorage(data: string | URL | ArrayBuffer | Uint8Array, mimeType: string): string {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof URL) {
    return data.toString();
  }

  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const base64 = uint8ArrayToBase64(bytes);
  if (base64.startsWith('data:')) {
    return base64;
  }

  return `data:${mimeType};base64,${base64}`;
}
