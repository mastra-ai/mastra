import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { datasetIdentity } from '../tests/evaluation-fixtures.js';
import { fixtureFiles, liabilityDocuments, propertyDocuments } from '../tests/reconciliation-fixtures.js';

const root = resolve('.runtime/use-cases');
await mkdir(root, { recursive: true, mode: 0o700 });
const manifest: unknown[] = [];
for (const [name, documents] of [
  ['property', propertyDocuments()],
  ['liability', liabilityDocuments()],
] as const) {
  const directory = join(root, name);
  await mkdir(directory, { recursive: true });
  const { files } = await fixtureFiles(documents);
  for (const file of files)
    await writeFile(join(directory, file.name), Buffer.from(file.data.split(',')[1]!, 'base64'), { mode: 0o600 });
  manifest.push({
    profile: name,
    intent: name === 'property' ? 'agreed_terms_checking' : 'document_comparison',
    documents: documents.map((d, i) => ({
      path: join(directory, d.name),
      role: i === 0 ? 'proposal' : i === 1 ? (name === 'property' ? 'issued_policy' : 'contract') : 'amendment',
      pages: d.pages.length,
    })),
    expected:
      name === 'property'
        ? 'Warehouse B is omitted; the deductible change is documented; water wording differs and requires review.'
        : 'The response assistance extension falls from USD 75000 to USD 50000; no contractual acceptance is inferred.',
  });
}
await writeFile(
  join(root, 'manifest.json'),
  JSON.stringify(
    {
      description:
        'Property and professional-liability use cases. These are not insurer-issued forms or current coverage advice.',
      dataset: datasetIdentity,
      useCases: manifest,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
process.stdout.write(
  `Prepared property and professional-liability PDFs in ${root}. Read manifest.json, then upload the files in Studio. No model call was made.\n`,
);
