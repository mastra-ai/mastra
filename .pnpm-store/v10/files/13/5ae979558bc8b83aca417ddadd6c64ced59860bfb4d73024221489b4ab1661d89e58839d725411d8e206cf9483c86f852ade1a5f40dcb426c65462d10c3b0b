'use strict';

const lite = require('./lite.cjs');

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
  return stackframesLiteToStackframes(lite.parse(error, options));
}
function parseV8OrIE(error) {
  return stackframesLiteToStackframes(lite.parseV8OrIE(error));
}
function parseFFOrSafari(error) {
  return stackframesLiteToStackframes(lite.parseFFOrSafari(error));
}
function parseOpera(e) {
  return stackframesLiteToStackframes(lite.parseOpera(e));
}
function parseOpera9(e) {
  return stackframesLiteToStackframes(lite.parseOpera9(e));
}
function parseOpera10(e) {
  return stackframesLiteToStackframes(lite.parseOpera10(e));
}
function parseOpera11(error) {
  return stackframesLiteToStackframes(lite.parseOpera11(error));
}

exports.extractLocation = lite.extractLocation;
exports.parse = parse;
exports.parseFFOrSafari = parseFFOrSafari;
exports.parseOpera = parseOpera;
exports.parseOpera10 = parseOpera10;
exports.parseOpera11 = parseOpera11;
exports.parseOpera9 = parseOpera9;
exports.parseV8OrIE = parseV8OrIE;
