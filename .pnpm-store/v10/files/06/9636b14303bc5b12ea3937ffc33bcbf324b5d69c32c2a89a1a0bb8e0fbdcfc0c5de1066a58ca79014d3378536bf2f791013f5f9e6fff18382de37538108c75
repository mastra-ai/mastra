"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _helperPluginUtils = require("@babel/helper-plugin-utils");
var _pluginTransformFlowStripTypes = require("@babel/plugin-transform-flow-strip-types");
var _normalizeOptions = require("./normalize-options.js");
var _default = exports.default = (0, _helperPluginUtils.declarePreset)((api, opts) => {
  api.assertVersion(7);
  const {
    all,
    allowDeclareFields,
    ignoreExtensions = true,
    experimental_useHermesParser: useHermesParser = false
  } = (0, _normalizeOptions.default)(opts);
  const plugins = [[_pluginTransformFlowStripTypes.default, {
    all,
    allowDeclareFields
  }]];
  if (useHermesParser) {
    if (Number.parseInt(process.versions.node, 10) < 12) {
      throw new Error("The Hermes parser is only supported in Node 12 and later.");
    }
    ;
    plugins.unshift("babel-plugin-syntax-hermes-parser");
  }
  if (ignoreExtensions) {
    return {
      plugins
    };
  }
  return {
    overrides: [{
      test: filename => filename == null || !/\.tsx?$/.test(filename),
      plugins
    }]
  };
});

//# sourceMappingURL=index.js.map
