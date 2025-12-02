"use strict";

const cache = require("./cache.cjs");
function initialize(babel) {
  exports.init = null;
  exports.version = babel.version;
  exports.DEFAULT_EXTENSIONS = babel.DEFAULT_EXTENSIONS;
  exports.loadOptionsAsync = babel.loadOptionsAsync;
  exports.transformAsync = babel.transformAsync;
  exports.getEnv = babel.getEnv;
  {
    exports.OptionManager = babel.OptionManager;
    exports.transformSync = babel.transformSync;
  }
  cache.initializeCacheFilename();
}
{
  initialize(require("@babel/core"));
}

//# sourceMappingURL=babel-core.cjs.map
