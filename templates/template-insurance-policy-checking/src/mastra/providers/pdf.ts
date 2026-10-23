import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { InputLimits } from '../../config/limits.js';
import { hashBytes, roleSchema, type InputProvider } from '../domain/contracts.js';
import { IntakeError } from '../domain/errors.js';
import { projectRoot } from '../runtime/paths.js';

export function attachmentSchema(limits: InputLimits) {
  const maxEncodedLength = 'data:application/pdf;base64,'.length + Math.ceil(limits.pdf.maxBytesPerFile / 3) * 4;
  return z
    .object({
      files: z
        .array(
          z
            .object({
              name: z.string().min(1).max(255),
              data: z
                .string()
                .startsWith('data:application/pdf;base64,')
                .superRefine((value, context) => {
                  if (value.length > maxEncodedLength)
                    context.addIssue({
                      code: 'custom',
                      message: 'PDF byte capacity exceeded.',
                      params: { inputLimit: 'pdfBytes', effectiveLimit: limits.pdf.maxBytesPerFile },
                    });
                }),
              role: roleSchema.default('unknown'),
            })
            .strict(),
        )
        .min(1)
        .superRefine((files, context) => {
          const roles = new Map<string, string>();
          for (const file of files) {
            const previous = roles.get(file.data);
            if (previous && previous !== 'unknown' && file.role !== 'unknown' && previous !== file.role)
              context.addIssue({
                code: 'custom',
                message: 'Identical attachments have conflicting roles.',
                params: { inputConflict: 'roles' },
              });
            if (file.role !== 'unknown') roles.set(file.data, file.role);
          }
          if (new Set(files.map(file => file.data)).size > limits.maxDocumentsPerCase)
            context.addIssue({
              code: 'custom',
              message: 'Document capacity exceeded.',
              params: { inputLimit: 'documents', effectiveLimit: limits.maxDocumentsPerCase },
            });
        }),
    })
    .strict();
}
const extractionSchema = z.object({
  pages: z
    .array(z.object({ physicalPage: z.number().int().positive(), text: z.string(), limitation: z.string().optional() }))
    .min(1),
});

export async function extractPdf(
  bytes: Uint8Array,
  maxPages: number,
  workerPath = resolve(projectRoot(), 'scripts/pdf-worker.mjs'),
) {
  return new Promise<z.infer<typeof extractionSchema>['pages']>((resolveResult, reject) => {
    // A static POSIX launcher applies CPU/core-dump limits before exec; arguments never enter shell source.
    // The V8 heap bound is separate and does not impose a hard RSS ceiling.
    const child = spawn(
      '/bin/sh',
      [
        '-c',
        'ulimit -c 0; ulimit -t 10; exec "$@"',
        'pdf-parser',
        process.execPath,
        '--max-old-space-size=128',
        '--max-semi-space-size=16',
        workerPath,
      ],
      { stdio: ['pipe', 'pipe', 'ignore'] },
    );
    const chunks: Buffer[] = [];
    let outputSize = 0;
    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      clearTimeout(timeout);
      reject(
        new IntakeError(
          'UNREADABLE_PDF',
          message,
          'Upload an unlocked, valid textual PDF within the configured limits.',
        ),
      );
    };
    const timeout = setTimeout(() => fail('PDF extraction exceeded its 15-second processing limit.'), 15_000);
    child.on('error', () => fail('The local PDF parser could not start.'));
    child.stdin.on('error', () => fail('PDF extraction stopped before accepting the document.'));
    child.stdout.on('data', (chunk: Buffer) => {
      outputSize += chunk.length;
      if (outputSize > 8 * 1024 * 1024) return fail('PDF extracted text exceeded the 8 MiB parser output limit.');
      chunks.push(chunk);
    });
    child.on('close', code => {
      if (settled) return;
      clearTimeout(timeout);
      if (code !== 0) return fail('The PDF parser stopped within its CPU or memory safety boundary.');
      try {
        // PDF.js diagnostics can precede the single JSON result on stdout.
        const output = Buffer.concat(chunks).toString();
        const result = JSON.parse(output.slice(output.lastIndexOf('\n') + 1)) as { error?: string };
        if (result.error === 'PAGE_LIMIT') {
          settled = true;
          reject(
            new IntakeError(
              'PAGE_LIMIT',
              `Each PDF must have at most ${maxPages} physical pages.`,
              'Upload a shorter textual PDF or change src/config/limits.ts and restart.',
            ),
          );
          return;
        }
        if (result.error) return fail('The PDF is corrupt, encrypted or unsupported.');
        const parsed = extractionSchema.parse(result);
        settled = true;
        resolveResult(parsed.pages);
      } catch {
        fail('The PDF did not produce verifiable physical-page text.');
      }
    });
    child.stdin.end(JSON.stringify({ base64: Buffer.from(bytes).toString('base64'), maxPages }));
  });
}

export function createPdfProvider(limits: InputLimits, workerPath?: string): InputProvider {
  const schema = attachmentSchema(limits);
  return {
    id: 'local-pdf',
    category: 'input',
    capabilities: ['pdf-attachments'],
    requestSchema: schema,
    async capture(input, _context, effectiveLimits) {
      const request = schema.parse(input);
      const sources = [];
      const seen = new Set<string>();
      for (const file of request.files) {
        const encoded = file.data.slice('data:application/pdf;base64,'.length);
        const bytes = Buffer.from(encoded, 'base64');
        if (bytes.toString('base64') !== encoded)
          throw new IntakeError(
            'INVALID_ATTACHMENT',
            'A PDF attachment has invalid byte encoding.',
            'Attach the local PDF file again.',
          );
        if (!bytes.length || bytes.length > effectiveLimits.pdf.maxBytesPerFile)
          throw new IntakeError(
            'BYTE_LIMIT',
            `Each PDF must contain 1 to ${effectiveLimits.pdf.maxBytesPerFile} bytes.`,
            'Upload a smaller textual PDF or change src/config/limits.ts and restart.',
          );
        if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))
          throw new IntakeError(
            'UNSUPPORTED_FILE',
            'The attachment is not a PDF, regardless of its name or media type.',
            'Upload a valid textual PDF.',
          );
        const hash = hashBytes(bytes);
        if (seen.has(hash)) continue;
        seen.add(hash);
        const pages = await extractPdf(bytes, effectiveLimits.pdf.maxPagesPerFile, workerPath);
        if (!pages.some(page => page.text.trim()))
          throw new IntakeError(
            'NO_SEARCHABLE_TEXT',
            'The PDF has no searchable text. Image-only and empty documents cannot be used as evidence.',
            'Upload a textual PDF. OCR is not supported.',
          );
        sources.push({
          sourceId: randomUUID(),
          version: '1',
          hash,
          role: file.role,
          displayName: file.name,
          kind: 'pdf' as const,
          bytes,
          pages,
          limitations: pages
            .filter(page => page.limitation)
            .map(page => `Physical page ${page.physicalPage}: ${page.limitation}`),
          provenance: {
            providerId: 'local-pdf',
            capturedAt: new Date().toISOString(),
            origin: 'direct-attachment',
            sourceVersion: '1',
          },
        });
      }
      return { sources };
    },
  };
}
