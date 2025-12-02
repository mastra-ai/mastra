"use strict";

const babel = require("./babel-core.cjs");
const transform = require("./transform.cjs");
module.exports = function handleMessage(action, payload) {
  switch (action) {
    case "GET_DEFAULT_EXTENSIONS":
      return babel.DEFAULT_EXTENSIONS;
    case "SET_OPTIONS":
      transform.setOptions(payload);
      return;
    case "TRANSFORM":
      return transform.transform(payload.code, payload.filename);
    case "TRANSFORM_SYNC":
      {
        return transform.transformSync(payload.code, payload.filename);
      }
  }
  throw new Error(`Unknown internal parser worker action: ${action}`);
};

//# sourceMappingURL=handle-message.cjs.map
