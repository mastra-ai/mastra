"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getStatistics = void 0;
var getStatistics = exports.getStatistics = function getStatistics(view) {
  return {
    line: view.state.doc.lineAt(view.state.selection.main.from),
    lineCount: view.state.doc.lines,
    lineBreak: view.state.lineBreak,
    length: view.state.doc.length,
    readOnly: view.state.readOnly,
    tabSize: view.state.tabSize,
    selection: view.state.selection,
    selectionAsSingle: view.state.selection.asSingle().main,
    ranges: view.state.selection.ranges,
    selectionCode: view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to),
    selections: view.state.selection.ranges.map(function (r) {
      return view.state.sliceDoc(r.from, r.to);
    }),
    selectedText: view.state.selection.ranges.some(function (r) {
      return !r.empty;
    })
  };
};