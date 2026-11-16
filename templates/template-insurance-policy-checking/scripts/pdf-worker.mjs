// One untrusted PDF per process. The parent supplies CPU, heap, time and output limits.
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const { base64, maxPages } = JSON.parse(Buffer.concat(chunks).toString());
let task;
try {
  task = getDocument({
    data: new Uint8Array(Buffer.from(base64, 'base64')),
    isEvalSupported: false,
    useSystemFonts: true,
    stopAtErrors: true,
    maxImageSize: 4 * 1024 * 1024,
  });
  const document = await task.promise;
  if (document.numPages > maxPages) {
    process.stdout.write(JSON.stringify({ error: 'PAGE_LIMIT' }));
  } else {
    const pages = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const text = content.items
        .filter(item => 'str' in item)
        .map(item => `${item.str}${item.hasEOL ? '\n' : ' '}`)
        .join('')
        .trimEnd();
      const operators = await page.getOperatorList();
      const hasImage = operators.fnArray.some(op =>
        [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject].includes(op),
      );
      const limitation = !text.trim()
        ? hasImage
          ? 'Image-only page: no searchable text; OCR is not supported.'
          : operators.fnArray.length
            ? 'No searchable text; blank/vector content cannot support absence claims.'
            : 'Blank physical page.'
        : hasImage
          ? 'Mixed text and image content: image text has not been extracted.'
          : undefined;
      pages.push({ physicalPage: number, text, ...(limitation ? { limitation } : {}) });
      page.cleanup();
    }
    process.stdout.write(JSON.stringify({ pages }));
  }
} catch {
  process.stdout.write(JSON.stringify({ error: 'UNREADABLE_PDF' }));
} finally {
  await task?.destroy();
}
