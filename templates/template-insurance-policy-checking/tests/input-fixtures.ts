import { randomUUID } from 'node:crypto';
import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, StandardFonts } from 'pdf-lib';
import { z } from 'zod';
import {
  canonicalJson,
  hashBytes,
  type InputProvider,
  type SourceBundle,
} from '../src/mastra/domain/case-contracts.js';

export async function policyPdf(
  title = 'Issued policy SYN-CP-001',
  pageCount = 2,
  options: { scan?: boolean; blankPage?: boolean; encrypted?: boolean; printedLabels?: boolean } = {},
) {
  const document = await PDFDocument.create();
  document.setCreationDate(new Date('2026-01-01T00:00:00Z'));
  document.setModificationDate(new Date('2026-01-01T00:00:00Z'));
  const font = await document.embedFont(StandardFonts.Helvetica);
  const image = options.scan
    ? await document.embedPng(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0uoAAAAASUVORK5CYII=',
          'base64',
        ),
      )
    : undefined;
  for (let index = 0; index < pageCount; index++) {
    const page = document.addPage([612, 792]);
    if (options.blankPage && index === pageCount - 1) continue;
    if (image && index === pageCount - 1) {
      page.drawImage(image, { x: 50, y: 50, width: 400, height: 600 });
      continue;
    }
    const lines =
      index === 0
        ? [
            title,
            'Insurance document and coverage schedule.',
            'Insured: Elm Harbor Fabrication LLC',
            'Product: Commercial property',
            'Policy period: 01 Jan 2026 to 01 Jan 2027',
            'Premises: 18 Cedar Lane, North Bay, CA',
            'Building limit: USD 2,500,000',
            'Deductible: USD 5,000 each occurrence',
            'Premium: USD 8,750; taxes and fees: USD 150',
            'These declarations summarize the attached coverage schedule.',
          ]
        : [
            title,
            'Coverage schedule and conditions',
            `Physical source sheet ${index + 1}`,
            'Business personal property limit: USD 500,000',
            'Business interruption period: 12 months',
            'Water damage is subject to the terms and exclusions below.',
            'The insured must notify the insurer promptly after a loss.',
            'Valuation follows replacement cost subject to stated conditions.',
            'This document does not establish contractual acceptance without an acceptance record.',
          ];
    if (options.printedLabels) lines.push(`Printed label ${index === 0 ? 'A' : index + 10}`);
    lines.forEach((line, row) => page.drawText(line, { font, size: 11, x: 45, y: 740 - row * 25 }));
  }
  if (options.encrypted) {
    const encrypt = document.context.register(PDFDict.withContext(document.context));
    const dictionary = document.context.lookup(encrypt, PDFDict);
    dictionary.set(PDFName.of('Filter'), PDFName.of('Standard'));
    dictionary.set(PDFName.of('V'), PDFNumber.of(1));
    dictionary.set(PDFName.of('R'), PDFNumber.of(2));
    dictionary.set(PDFName.of('P'), PDFNumber.of(-4));
    dictionary.set(PDFName.of('O'), PDFHexString.of('0'.repeat(64)));
    dictionary.set(PDFName.of('U'), PDFHexString.of('0'.repeat(64)));
    document.context.trailerInfo.Encrypt = encrypt;
  }
  return Buffer.from(await document.save({ useObjectStreams: false }));
}
export const fileInput = (bytes: Uint8Array, name = 'policy.pdf') => ({
  files: [{ name, data: `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}` }],
});
export function recordProvider(
  id = 'records',
  records: Record<string, Record<string, unknown>> = {
    contract: { limit: 'USD 250000', insured: 'Elm Harbor Fabrication LLC' },
  },
): InputProvider {
  return {
    id,
    category: 'input',
    capabilities: ['structured-records'],
    requestSchema: z.object({}).strict(),
    async capture() {
      const captured = structuredClone(records);
      return {
        sources: [
          {
            sourceId: randomUUID(),
            version: '2026-01',
            hash: hashBytes(canonicalJson(captured)),
            role: 'contract',
            displayName: 'Captured contract record',
            kind: 'records',
            records: captured,
            evidence: Object.entries(captured).flatMap(([recordId, fields]) =>
              Object.entries(fields).map(([field, value]) => ({ recordId, field, value })),
            ),
            limitations: [],
            provenance: {
              providerId: id,
              capturedAt: new Date().toISOString(),
              origin: 'test-owned-local-records',
              sourceVersion: '2026-01',
            },
          },
        ],
      } satisfies SourceBundle;
    },
  };
}
