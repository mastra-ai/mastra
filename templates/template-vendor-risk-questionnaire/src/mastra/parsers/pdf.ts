import type { InputLimits } from '../contracts/limits.ts';
import { ParseFault } from './contract.ts';
import type { ExtractedBlock, FormatParser } from './contract.ts';

async function extractEvidence(bytes: Uint8Array, limits: InputLimits): Promise<ExtractedBlock[]> {
  const blocks: ExtractedBlock[] = [];
  const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: bytes,
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: true,
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    if (doc.numPages > limits.maxPdfPages) throw new ParseFault('LIMIT_EXCEEDED');
    if (
      (await doc.getJSActions()) ||
      (await doc.getAttachments()) ||
      (await doc.getFieldObjects()) ||
      (await doc.getOpenAction())
    )
      throw new ParseFault('UNSUPPORTED_LAYOUT');
    for (let page = 1; page <= doc.numPages; page++) {
      const p = await doc.getPage(page);
      if ((await p.getJSActions()) || (await p.getAnnotations()).length) throw new ParseFault('UNSUPPORTED_LAYOUT');
      const operators = await p.getOperatorList();
      if (
        operators.fnArray.some(op =>
          [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject].includes(op),
        )
      )
        throw new ParseFault('UNSUPPORTED_LAYOUT');
      const c = await p.getTextContent();
      const items = c.items.filter((i): i is import('pdfjs-dist/types/src/display/api.js').TextItem => 'str' in i);
      if (!items.length || items.every(i => !i.str.trim())) throw new ParseFault('UNSUPPORTED_LAYOUT');
      for (const [block, item] of items.entries())
        if (item.str.trim()) blocks.push({ text: item.str, locator: { kind: 'pdf.block', page, block } });
    }
  } catch (e) {
    if (e instanceof ParseFault) throw e;
    if (e instanceof Error && e.name === 'PasswordException') throw new ParseFault('ENCRYPTED_FILE');
    throw new ParseFault('CORRUPT_FILE');
  } finally {
    await task.destroy();
  }
  return blocks;
}
export const parser: FormatParser = { format: 'pdf', extractEvidence };
