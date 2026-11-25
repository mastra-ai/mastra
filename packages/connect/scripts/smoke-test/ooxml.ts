import { crc32 } from 'node:zlib';

const NS = 'http://schemas.openxmlformats.org';
const CT = 'application/vnd.openxmlformats';
const xml = (body: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`;
const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Packs files into an uncompressed (stored) ZIP so no archive dependency is needed. */
function buildStoredZip(files: Array<[name: string, content: string]>): Buffer {
  // Local headers + data, then central directory, then EOCD.
  const DOS_DATE_1980_01_01 = 0x21;
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(DOS_DATE_1980_01_01, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(DOS_DATE_1980_01_01, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralDir, eocd]);
}

/** Builds the smallest .xlsx Excel Online accepts: one empty worksheet named `sheetName`. */
export function buildMinimalXlsx(sheetName: string): Buffer {
  return buildStoredZip([
    [
      '[Content_Types].xml',
      xml(
        `<Types xmlns="${NS}/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="${CT}-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="${CT}-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${CT}-officedocument.spreadsheetml.worksheet+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="${CT}-officedocument.spreadsheetml.styles+xml"/>` +
          `</Types>`,
      ),
    ],
    [
      '_rels/.rels',
      xml(
        `<Relationships xmlns="${NS}/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
      ),
    ],
    [
      'xl/workbook.xml',
      xml(
        `<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    ],
    [
      'xl/_rels/workbook.xml.rels',
      xml(
        `<Relationships xmlns="${NS}/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
          `<Relationship Id="rId2" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`,
      ),
    ],
    ['xl/worksheets/sheet1.xml', xml(`<worksheet xmlns="${NS}/spreadsheetml/2006/main"><sheetData/></worksheet>`)],
    [
      'xl/styles.xml',
      xml(
        `<styleSheet xmlns="${NS}/spreadsheetml/2006/main">` +
          `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
          `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
          `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
          `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
          `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
          `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
          `</styleSheet>`,
      ),
    ],
  ]);
}

/**
 * Builds the smallest .pptx PowerPoint Online can render and export: one slide
 * with a text box, backed by the slide master, slide layout, and theme parts
 * PowerPoint requires for every slide.
 */
export function buildMinimalPptx(title: string): Buffer {
  const pml = `xmlns:a="${NS}/drawingml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships" xmlns:p="${NS}/presentationml/2006/main"`;
  const rel = (id: string, type: string, target: string) =>
    `<Relationship Id="${id}" Type="${NS}/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  const rels = (...entries: string[]) =>
    xml(`<Relationships xmlns="${NS}/package/2006/relationships">${entries.join('')}</Relationships>`);
  const emptyGroup =
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;
  const solid = (color: string) => `<a:solidFill><a:schemeClr val="${color}"/></a:solidFill>`;
  const line = (width: number) =>
    `<a:ln w="${width}" cap="flat" cmpd="sng" algn="ctr">${solid('phClr')}<a:prstDash val="solid"/></a:ln>`;
  const fonts = (typeface: string) => `<a:latin typeface="${typeface}"/><a:ea typeface=""/><a:cs typeface=""/>`;

  return buildStoredZip([
    [
      '[Content_Types].xml',
      xml(
        `<Types xmlns="${NS}/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="${CT}-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/ppt/presentation.xml" ContentType="${CT}-officedocument.presentationml.presentation.main+xml"/>` +
          `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${CT}-officedocument.presentationml.slideMaster+xml"/>` +
          `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${CT}-officedocument.presentationml.slideLayout+xml"/>` +
          `<Override PartName="/ppt/slides/slide1.xml" ContentType="${CT}-officedocument.presentationml.slide+xml"/>` +
          `<Override PartName="/ppt/theme/theme1.xml" ContentType="${CT}-officedocument.theme+xml"/>` +
          `</Types>`,
      ),
    ],
    ['_rels/.rels', rels(rel('rId1', 'officeDocument', 'ppt/presentation.xml'))],
    [
      'ppt/presentation.xml',
      xml(
        `<p:presentation ${pml}>` +
          `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
          `<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>` +
          `<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>` +
          `</p:presentation>`,
      ),
    ],
    [
      'ppt/_rels/presentation.xml.rels',
      rels(
        rel('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'),
        rel('rId2', 'slide', 'slides/slide1.xml'),
        rel('rId3', 'theme', 'theme/theme1.xml'),
      ),
    ],
    [
      'ppt/slideMasters/slideMaster1.xml',
      xml(
        `<p:sldMaster ${pml}>` +
          `<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${emptyGroup}</p:spTree></p:cSld>` +
          `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
          `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
          `</p:sldMaster>`,
      ),
    ],
    [
      'ppt/slideMasters/_rels/slideMaster1.xml.rels',
      rels(rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'), rel('rId2', 'theme', '../theme/theme1.xml')),
    ],
    [
      'ppt/slideLayouts/slideLayout1.xml',
      xml(
        `<p:sldLayout ${pml} type="blank" preserve="1">` +
          `<p:cSld name="Blank"><p:spTree>${emptyGroup}</p:spTree></p:cSld>` +
          `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
          `</p:sldLayout>`,
      ),
    ],
    [
      'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      rels(rel('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')),
    ],
    [
      'ppt/slides/slide1.xml',
      xml(
        `<p:sld ${pml}>` +
          `<p:cSld><p:spTree>${emptyGroup}` +
          `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
          `<p:spPr><a:xfrm><a:off x="838200" y="2743200"/><a:ext cx="10515600" cy="1325563"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
          `<p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="3200"/><a:t>${escapeXml(title)}</a:t></a:r></a:p></p:txBody>` +
          `</p:sp></p:spTree></p:cSld>` +
          `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
          `</p:sld>`,
      ),
    ],
    ['ppt/slides/_rels/slide1.xml.rels', rels(rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'))],
    [
      'ppt/theme/theme1.xml',
      xml(
        `<a:theme xmlns:a="${NS}/drawingml/2006/main" name="Office Theme"><a:themeElements>` +
          `<a:clrScheme name="Office">` +
          `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
          `<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>` +
          `<a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2>` +
          `<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>` +
          `<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6>` +
          `<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>` +
          `</a:clrScheme>` +
          `<a:fontScheme name="Office"><a:majorFont>${fonts('Calibri Light')}</a:majorFont><a:minorFont>${fonts('Calibri')}</a:minorFont></a:fontScheme>` +
          `<a:fmtScheme name="Office">` +
          `<a:fillStyleLst>${solid('phClr').repeat(3)}</a:fillStyleLst>` +
          `<a:lnStyleLst>${line(6350)}${line(12700)}${line(19050)}</a:lnStyleLst>` +
          `<a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst>` +
          `<a:bgFillStyleLst>${solid('phClr').repeat(3)}</a:bgFillStyleLst>` +
          `</a:fmtScheme>` +
          `</a:themeElements></a:theme>`,
      ),
    ],
  ]);
}
