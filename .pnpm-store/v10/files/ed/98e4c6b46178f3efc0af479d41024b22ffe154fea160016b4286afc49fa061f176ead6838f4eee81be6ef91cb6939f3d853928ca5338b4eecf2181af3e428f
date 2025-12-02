import unicode from './unicode';

export const isSpaceSeparator = (c?: string): boolean => {
  return typeof c === 'string' && unicode.Space_Separator.test(c);
};

export const isIdStartChar = (c?: string): boolean => {
  return typeof c === 'string' && (
    (c >= 'a' && c <= 'z') ||
    (c >= 'A' && c <= 'Z') ||
    (c === '$') || (c === '_') ||
    unicode.ID_Start.test(c)
  );
};

export const isIdContinueChar = (c?: string): boolean => {
  return typeof c === 'string' && (
    (c >= 'a' && c <= 'z') ||
    (c >= 'A' && c <= 'Z') ||
    (c >= '0' && c <= '9') ||
    (c === '$') || (c === '_') ||
    (c === '\u200C') || (c === '\u200D') ||
    unicode.ID_Continue.test(c)
  );
};

export const isDigit = (c?: string): boolean => {
  return typeof c === 'string' && /[0-9]/.test(c);
};

export const isInteger = (s?: string): boolean => {
  return typeof s === 'string' && !/[^0-9]/.test(s);
};

export const isHex = (s?: string): boolean => {
  return typeof s === 'string' && /0x[0-9a-f]+$/i.test(s);
};

export const isHexDigit = (c?: string): boolean => {
  return typeof c === 'string' && /[0-9a-f]/i.test(c);
};
