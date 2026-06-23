export function convertSignalDataToBase64String(content: string | ArrayBuffer | Uint8Array): string {
  if (typeof content === 'string') {
    return content;
  }

  const bytes = content instanceof ArrayBuffer ? new Uint8Array(content) : content;
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
