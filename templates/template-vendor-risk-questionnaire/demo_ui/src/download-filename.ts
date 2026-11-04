export function downloadFilename(headers: Headers) {
  const disposition = headers.get('Content-Disposition') ?? '';
  let filename = disposition
    .match(/(?:^|;)\s*filename\s*=\s*(?:"([^"]+)"|([^;]+))/i)
    ?.slice(1)
    .find(Boolean)
    ?.trim();
  const encoded = disposition.match(/(?:^|;)\s*filename\*\s*=\s*UTF-8'[^']*'([^;]+)/i)?.[1];
  if (encoded) {
    try {
      filename = decodeURIComponent(encoded.trim());
    } catch {
      // A malformed extended name must not prevent downloading the document.
    }
  }
  filename = filename?.split(/[\\/]/).at(-1) || 'answered';
  const mediaType = headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  const extension =
    mediaType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ? '.xlsx'
      : mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ? '.docx'
        : '';
  return /\.[^.]+$/.test(filename) ? filename : filename + extension;
}
