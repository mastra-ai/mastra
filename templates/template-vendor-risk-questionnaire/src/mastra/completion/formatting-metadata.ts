import { z } from 'zod';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const uuidSchema = z.string().regex(new RegExp(`^(?:${uuid}|\\{${uuid}\\})$`, 'i'));
const panoseSchema = z.string().regex(/^[0-9a-f]{20}$/i);
const tintSchema = z
  .string()
  .max(24)
  .regex(/^-?(?:0(?:\.\d+)?|1(?:\.0+)?)$/);
const sheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const revision = 'http://schemas.microsoft.com/office/spreadsheetml/2014/revision';
const revision2 = 'http://schemas.microsoft.com/office/spreadsheetml/2015/revision2';
const revision10 = 'http://schemas.microsoft.com/office/spreadsheetml/2016/revision10';
const theme = 'http://schemas.microsoft.com/office/thememl/2012/main';

// Validate exact formatting slots as typed data. The same numeric/UUID string in
// text, comments, labels, or an unrelated attribute still receives PII screening.
export function isFormattingMetadata(
  part: string,
  elementNamespace: string | undefined,
  element: string,
  attributeNamespace: string | undefined,
  attribute: string,
  value: string,
) {
  if (
    (part === 'xl/workbook.xml' &&
      ((elementNamespace === revision &&
        element === 'revisionPtr' &&
        attributeNamespace === revision10 &&
        attribute === 'uidLastSave') ||
        (elementNamespace === sheet &&
          element === 'workbookView' &&
          attributeNamespace === revision2 &&
          attribute === 'uid'))) ||
    (/^xl\/worksheets\/sheet\d+\.xml$/.test(part) &&
      elementNamespace === sheet &&
      element === 'worksheet' &&
      attributeNamespace === revision &&
      attribute === 'uid') ||
    (/^xl\/theme\/theme\d+\.xml$/.test(part) &&
      elementNamespace === theme &&
      element === 'themeFamily' &&
      !attributeNamespace &&
      ['id', 'vid'].includes(attribute))
  )
    return uuidSchema.safeParse(value).success;
  if (
    /^xl\/theme\/theme\d+\.xml$/.test(part) &&
    elementNamespace === drawing &&
    ['latin', 'ea', 'cs', 'font'].includes(element) &&
    !attributeNamespace &&
    attribute === 'panose'
  )
    return panoseSchema.safeParse(value).success;
  if (
    part === 'xl/styles.xml' &&
    elementNamespace === sheet &&
    ['color', 'fgColor', 'bgColor'].includes(element) &&
    !attributeNamespace &&
    attribute === 'tint'
  )
    return tintSchema.safeParse(value).success;
  return false;
}
