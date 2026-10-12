import { resolve } from 'node:path';
import { generateRespondDemo } from '../tests/support/completion-demo.ts';

const destination = resolve(process.argv[2] ?? `.runtime/offline-respond-${Date.now()}`);
for (const format of ['xlsx', 'docx'] as const) {
  const output = await generateRespondDemo(destination, format);
  console.log(
    JSON.stringify({
      format,
      sourcePath: output.sourcePath,
      outputPath: output.outputPath,
      originalSha256: output.originalSha256,
      outputSha256: output.outputSha256,
      draftCalls: output.draftCalls,
    }),
  );
}
