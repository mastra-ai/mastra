import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

// Synthetic Excel save metadata, without any user workbook or personal paths.
export function withExcelFormatting(bytes: Uint8Array) {
  const files = unzipSync(bytes);
  const sheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const mc = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
  const xr = 'http://schemas.microsoft.com/office/spreadsheetml/2014/revision';
  const xr10 = 'http://schemas.microsoft.com/office/spreadsheetml/2016/revision10';
  const x14 = 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/main';
  const x15 = 'http://schemas.microsoft.com/office/spreadsheetml/2010/11/main';
  const x15ac = 'http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac';
  const x14ac = 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac';
  const thm15 = 'http://schemas.microsoft.com/office/thememl/2012/main';
  const uid = '{aaaaaaaa-aaaa-aaaa-aaaa-123456789012}';
  files['xl/workbook.xml'] = strToU8(
    strFromU8(files['xl/workbook.xml']!)
      .replace('<workbook ', `<workbook xmlns:mc="${mc}" xmlns:xr="${xr}" xmlns:xr10="${xr10}" mc:Ignorable="xr xr10" `)
      .replace(
        '<sheets>',
        `<fileVersion appName="xl"/><mc:AlternateContent><mc:Choice Requires="x15ac" xmlns:x15ac="${x15ac}"><x15ac:absPath url="/workbooks/"/></mc:Choice></mc:AlternateContent><xr:revisionPtr xr10:uidLastSave="${uid}"/><sheets>`,
      ),
  );
  const strings: string[] = [];
  files['xl/worksheets/sheet1.xml'] = strToU8(
    strFromU8(files['xl/worksheets/sheet1.xml']!)
      .replace('<worksheet ', `<worksheet xmlns:xr="${xr}" xmlns:x14ac="${x14ac}" xr:uid="${uid}" `)
      .replace('<sheetData>', '<cols><col min="1" max="9" width="32" customWidth="1"/></cols><sheetData>')
      .replace(/t="inlineStr"><is>(<t[^>]*>[^]*?<\/t>)<\/is>/g, (_, text: string) => {
        strings.push(text);
        return `t="s"><v>${strings.length - 1}</v>`;
      }),
  );
  files['xl/sharedStrings.xml'] = strToU8(
    `<sst xmlns="${sheet}">${strings.map(text => `<si>${text}</si>`).join('')}</sst>`,
  );
  files['xl/styles.xml'] = strToU8(
    `<styleSheet xmlns="${sheet}" xmlns:mc="${mc}" xmlns:x14ac="${x14ac}" xmlns:x14="${x14}" xmlns:x15="${x15}" mc:Ignorable="x14ac"><fonts count="1" x14ac:knownFonts="1"><font><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill><fgColor theme="1" tint="0.79998168889431442"/></patternFill></fill></fills><extLst><ext uri="{styles}"><x14:slicerStyles defaultSlicerStyle="SlicerStyleLight1"/><x15:timelineStyles defaultTimelineStyle="TimeSlicerStyleLight1"/></ext></extLst></styleSheet>`,
  );
  files['xl/theme/theme1.xml'] = strToU8(
    `<a:theme xmlns:a="${drawing}"><a:themeElements><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri" panose="02050302040000000000"/></a:majorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"><a:lumMod val="100000"/><a:alpha val="100000"/></a:schemeClr></a:solidFill></a:fillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults><a:lnDef><a:spPr/><a:bodyPr/><a:lstStyle/><a:style><a:lnRef idx="1"/><a:fillRef idx="0"/><a:effectRef idx="0"/><a:fontRef idx="minor"/></a:style></a:lnDef></a:objectDefaults><a:extLst><a:ext uri="{theme}"><thm15:themeFamily xmlns:thm15="${thm15}" name="Office" id="${uid}" vid="${uid}"/></a:ext></a:extLst></a:theme>`,
  );
  return zipSync(files);
}
