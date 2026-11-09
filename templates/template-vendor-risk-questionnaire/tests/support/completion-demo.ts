import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { strToU8, strFromU8, unzipSync, zipSync } from 'fflate';
import { xlsxFixture, docxFixture } from '../fixtures/office.ts';
import { draftingFixture, controlledProvider } from './drafting.ts';
import { attachParent } from './review.ts';
import { fixturePolicy } from './policy.ts';
import { respond } from '../../src/mastra/runtime/respond.ts';
import { sha256 } from '../../src/mastra/intake/source.ts';

export const demoLongAnswer =
  'Workforce MFA is required for production access. ' +
  'Access reviews compare active accounts with approved roles, record exceptions, and require an owner to resolve outstanding access. '.repeat(
    8,
  );
export async function generateRespondDemo(destination: string, format: 'xlsx' | 'docx') {
  const root = resolve(destination, format);
  try {
    await lstat(root);
    throw new Error('DEMO_DESTINATION_EXISTS');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await mkdir(root, { recursive: true });
  const fixture = await draftingFixture(root, {
      format,
      text: `control ${demoLongAnswer}`,
      questions: [{ text: 'Describe production workforce access controls.' }],
    }),
    provider = controlledProvider(fixture, [
      {
        text: demoLongAnswer,
        draft: d => ({
          ...d,
          claims: d.claims.map(c => ({
            ...c,
            text: 'Workforce MFA is required. Access reviews compare active accounts with approved roles, record exceptions, and require an owner to resolve outstanding access.',
          })),
        }),
      },
    ]),
    attached = attachParent(fixture, provider.factory);
  const rows = [
    [
      'Reference',
      'Inquiry',
      'Response kind',
      'Allowed values',
      'Domain',
      'Guidance',
      'Buyer response',
      'Explanation',
      'Evidence',
    ],
    [
      'Q1',
      'Describe production workforce access controls.',
      'boolean',
      'yes|no|partial|not_applicable|unknown',
      'access',
      'Retain scope and review qualifications.',
      '',
      '',
      '',
    ],
  ];
  const entries = unzipSync(
    format === 'xlsx' ? xlsxFixture([{ name: 'Vendor inquiry', rows }]) : docxFixture([{ table: rows }]),
  );
  if (format === 'xlsx') {
    const p = 'xl/worksheets/sheet1.xml';
    entries[p] = strToU8(
      strFromU8(entries[p]!)
        .replace(
          '<sheetData>',
          '<cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="35" customWidth="1"/><col min="3" max="7" width="18" customWidth="1"/><col min="8" max="8" width="72" customWidth="1"/><col min="9" max="9" width="35" customWidth="1"/></cols><sheetData>',
        )
        .replace(/<c r=/g, '<c s="1" r=')
        .replace(
          '</worksheet>',
          '<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>',
        ),
    );
    entries['xl/_rels/workbook.xml.rels'] = strToU8(
      strFromU8(entries['xl/_rels/workbook.xml.rels']!).replace(
        '</Relationships>',
        '<Relationship Id="rStyle" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      ),
    );
    entries['[Content_Types].xml'] = strToU8(
      strFromU8(entries['[Content_Types].xml']!).replace(
        '</Types>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      ),
    );
    entries['xl/styles.xml'] = strToU8(
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>',
    );
  } else {
    entries['word/document.xml'] = strToU8(
      strFromU8(entries['word/document.xml']!)
        .replace(
          '<w:tbl>',
          '<w:tbl><w:tblPr><w:tblW w:w="12500" w:type="dxa"/></w:tblPr><w:tblGrid>' +
            [600, 1800, 700, 1100, 700, 1400, 700, 4200, 1300].map(w => `<w:gridCol w:w="${w}"/>`).join('') +
            '</w:tblGrid>',
        )
        .replace(
          '<w:sectPr/>',
          '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>',
        ),
    );
  }
  const sourcePath = resolve(root, `source.${format}`),
    source = Buffer.from(zipSync(entries));
  await writeFile(sourcePath, source);
  const transcript: string[] = [],
    answers = ['release', 'APPROVE'];
  try {
    const output = await respond({
      databaseUrl: fixture.url,
      runtimeRoot: fixture.runtimeRoot,
      workflow: attached.workflow,
      models: provider.factory,
      sourcePath,
      profile: {
        schemaVersion: 1,
        evidenceRoot: resolve(root, 'evidence'),
        manifestPath: fixture.manifestPath,
        scope: fixture.snapshot.record.scope,
        policy: fixturePolicy,
      },
      io: { show: s => transcript.push(s), ask: async () => answers.shift() ?? null },
    });
    return {
      format,
      sourcePath,
      outputPath: output.path,
      originalSha256: sha256(source),
      outputSha256: sha256(await readFile(output.path)),
      manifest: output.manifest,
      transcript,
      draftCalls: provider.calls.filter(c => c.phase === 'draft').length,
    };
  } finally {
    await attached.mastra.shutdown();
  }
}
