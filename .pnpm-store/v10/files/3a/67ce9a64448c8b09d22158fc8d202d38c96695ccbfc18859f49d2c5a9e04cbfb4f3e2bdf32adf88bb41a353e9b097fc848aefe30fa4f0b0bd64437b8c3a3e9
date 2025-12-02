"use strict";

const hook = require("./hook.cjs");
const {
  LocalClient
} = require("./worker-client.cjs");
const client = new LocalClient();
function register(opts = {}) {
  return hook.register(client, Object.assign({}, opts));
}
module.exports = Object.assign(register, {
  revert: hook.revert,
  default: register
});

//# sourceMappingURL=node.cjs.map
