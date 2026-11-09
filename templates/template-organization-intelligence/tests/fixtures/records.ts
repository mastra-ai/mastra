import { officeArchive } from '../../src/mastra/evaluation/fixtures/documents.js';
export { officeArchive, pdf } from '../../src/mastra/evaluation/fixtures/documents.js';

export const docx = () =>
  officeArchive({
    'word/document.xml':
      '<w:document xmlns:w="word"><w:body><w:p><w:r><w:t>Records policy</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Owner</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Deadline</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Archivist</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Nine days</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>Closing paragraph</w:t></w:r></w:p></w:body></w:document>',
  });
export const xlsx = (detailsTarget = 'worksheets/rules.xml', targetMode = 'Internal') =>
  officeArchive({
    'xl/workbook.xml':
      '<workbook xmlns:r="relationships"><sheets><sheet name="Summary" r:id="a"/><sheet name="Details" r:id="b"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': `<Relationships><Relationship Id="a" Target="worksheets/overview.xml"/><Relationship Id="b" Target="${detailsTarget}" TargetMode="${targetMode}"/></Relationships>`,
    'xl/sharedStrings.xml': '<sst><si><t>Owner</t></si><si><r><t>Retention </t></r><r><t>rule</t></r></si></sst>',
    'xl/worksheets/overview.xml':
      '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Summary only</t></is></c></row></sheetData></worksheet>',
    'xl/worksheets/rules.xml':
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Finance</t></is></c><c r="B2" t="inlineStr"><is><t>Keep receipts for eleven years</t></is></c></row><row r="3"><c r="A3"><f>SUM(1,2)</f><v>3</v></c><c r="B3"><f>UNSUPPORTED()</f></c><c r="C3" t="e"><f>1/0</f><v>#DIV/0!</v></c></row></sheetData></worksheet>',
  });

export function googleFixture() {
  let failed = false;
  let incomplete = false;
  const files = new Map<
    string,
    {
      id: string;
      name: string;
      mimeType: string;
      parent: string;
      content: Buffer;
      docs?: unknown;
      version?: string;
      modifiedTime?: string;
    }
  >();
  const calls: string[] = [];
  const methods: string[] = [];
  const request: typeof fetch = async (input, options) => {
    methods.push(options?.method ?? 'GET');
    const url = new URL(String(input));
    calls.push(url.href);
    if (failed) return new Response('', { status: 503 });
    if (url.hostname === 'docs.googleapis.com') {
      const id = url.pathname.split('/').at(-1)!;
      return Response.json(files.get(id)?.docs ?? {});
    }
    if (url.pathname === '/drive/v3/files') {
      const parent = url.searchParams.get('q')?.match(/^'([^']+)'/)?.[1];
      return Response.json({
        files: [...files.values()]
          .filter(file => file.parent === parent)
          .map(({ id, name, mimeType, content, version, modifiedTime }) => ({
            id,
            name,
            mimeType,
            size: String(content.length),
            version,
            modifiedTime,
          })),
        incompleteSearch: incomplete,
      });
    }
    const id = url.pathname.split('/')[4]!;
    const file = files.get(decodeURIComponent(id));
    if (file && url.searchParams.has('fields')) {
      const { id, name, mimeType, content, version, modifiedTime } = file;
      return Response.json({ id, name, mimeType, size: String(content.length), version, modifiedTime });
    }
    return file ? new Response(new Uint8Array(file.content)) : new Response('', { status: 404 });
  };
  return {
    files,
    request,
    calls,
    methods,
    setFailed(value: boolean) {
      failed = value;
    },
    setIncomplete(value: boolean) {
      incomplete = value;
    },
  };
}
