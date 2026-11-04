import { File, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo } from 'lucide-react';
import { isRemoteUrl } from '@/lib/file';

export function attachmentName(name: string | undefined, src: string | undefined, fallback: string) {
  const value = name || src;
  if (!value) return fallback;
  if (!isRemoteUrl(value)) return name || fallback;
  try {
    const pathname = new URL(value).pathname;
    return decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) || '') || fallback;
  } catch {
    return fallback;
  }
}

export function attachmentInfo(name: string, contentType?: string) {
  const mime = contentType?.split(';')[0]?.trim().toLowerCase();
  const extension = name.match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toUpperCase();
  if (
    mime?.includes('spreadsheet') ||
    mime === 'application/vnd.ms-excel' ||
    ['XLS', 'XLSX', 'CSV', 'TSV', 'ODS'].includes(extension ?? '')
  ) {
    return { Icon: FileSpreadsheet, label: extension || 'Spreadsheet' };
  }
  if (mime?.startsWith('image/'))
    return { Icon: FileImage, label: extension || mime.slice(6).split('+')[0]?.toUpperCase() || 'Image' };
  if (mime === 'application/pdf' || extension === 'PDF') return { Icon: FileText, label: 'PDF' };
  if (mime?.startsWith('audio/')) return { Icon: FileAudio, label: extension || 'Audio' };
  if (mime?.startsWith('video/')) return { Icon: FileVideo, label: extension || 'Video' };
  if (mime?.startsWith('text/')) return { Icon: FileText, label: extension || 'Text' };
  return { Icon: File, label: extension || 'File' };
}

export function textAttachment(data: string, name?: string) {
  // Only strip a complete legacy envelope. Literal tags in named files are content.
  const envelope = name === undefined ? data.match(/^<attachment name="([^"]*)">([\s\S]*)<\/attachment>$/) : undefined;
  return {
    name:
      name ??
      envelope?.[1]?.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'),
    data: envelope?.[2] ?? data,
  };
}
