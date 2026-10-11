import { artifactCatalog } from '../contracts/artifact.ts';
import type { ArtifactName } from '../contracts/artifact.ts';
import type { Projection } from '../contracts/review.ts';
import { canonicalJson } from '../intake/source.ts';
import { xlsx, csv, markdown, exportRows } from './render.ts';
import { renderPdf } from './pdf.ts';
export { artifactCatalog } from '../contracts/artifact.ts';
export { validateBundleContent } from './validation.ts';
export async function renderBundle(p: Projection) {
  const rows = exportRows(p),
    files = new Map<ArtifactName, Buffer>();
  for (const artifact of artifactCatalog) {
    let bytes: Buffer;
    switch (artifact.format) {
      case 'xlsx':
        bytes = xlsx(p);
        break;
      case 'csv':
        bytes = Buffer.from(csv(artifact.role === 'evidence' ? rows.evidence : rows.questionnaire));
        break;
      case 'json':
        bytes = Buffer.from(canonicalJson(p) + '\n');
        break;
      case 'markdown':
        bytes = Buffer.from(markdown(p));
        break;
      case 'pdf':
        bytes = await renderPdf(p);
        break;
    }
    files.set(artifact.name, bytes);
  }
  return files;
}
