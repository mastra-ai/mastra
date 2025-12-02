import { parse as parse$1, parseV8OrIE as parseV8OrIE$1, parseFFOrSafari as parseFFOrSafari$1, parseOpera as parseOpera$1, parseOpera9 as parseOpera9$1, parseOpera10 as parseOpera10$1, parseOpera11 as parseOpera11$1 } from './lite.mjs';
export { extractLocation } from './lite.mjs';

function stackframesLiteToStackframes(liteStackframes) {
  return liteStackframes.map((liteStackframe) => {
    return {
      functionName: liteStackframe.function,
      args: liteStackframe.args,
      fileName: liteStackframe.file,
      lineNumber: liteStackframe.line,
      columnNumber: liteStackframe.col,
      source: liteStackframe.raw
    };
  });
}
function parse(error, options) {
  return stackframesLiteToStackframes(parse$1(error, options));
}
function parseV8OrIE(error) {
  return stackframesLiteToStackframes(parseV8OrIE$1(error));
}
function parseFFOrSafari(error) {
  return stackframesLiteToStackframes(parseFFOrSafari$1(error));
}
function parseOpera(e) {
  return stackframesLiteToStackframes(parseOpera$1(e));
}
function parseOpera9(e) {
  return stackframesLiteToStackframes(parseOpera9$1(e));
}
function parseOpera10(e) {
  return stackframesLiteToStackframes(parseOpera10$1(e));
}
function parseOpera11(error) {
  return stackframesLiteToStackframes(parseOpera11$1(error));
}

export { parse, parseFFOrSafari, parseOpera, parseOpera10, parseOpera11, parseOpera9, parseV8OrIE };
