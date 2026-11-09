import { z } from 'zod';
import { defaultLimits } from '../contracts/limits.ts';

const uploadSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^/\\\u0000-\u001f]+\.(xlsx|docx)$/i),
  size: z.number().int().positive().max(defaultLimits.maxBytes),
});
// Stream-limit before parsing multipart data; Content-Length alone is not a trusted bound.
export async function readQuestionnaireUpload(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('FILE_REQUIRED');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > defaultLimits.maxBytes + 65536) {
        await reader.cancel();
        throw new Error('FILE_SIZE_LIMIT');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const form = await new Response(Buffer.concat(chunks), {
    headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' },
  }).formData();
  const file = form.get('file');
  if (!(file instanceof File) || form.getAll('file').length !== 1) throw new Error('FILE_REQUIRED');
  uploadSchema.parse({ name: file.name, size: file.size });
  return file;
}
