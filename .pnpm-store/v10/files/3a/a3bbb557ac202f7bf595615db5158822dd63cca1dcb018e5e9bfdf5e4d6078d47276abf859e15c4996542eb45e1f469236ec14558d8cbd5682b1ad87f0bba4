"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _url = require("url");

var _matcher = _interopRequireDefault(require("matcher"));

var _errors = require("../errors");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const isUrlMatchingNoProxy = (subjectUrl, noProxy) => {
  const subjectUrlTokens = (0, _url.parse)(subjectUrl);
  const rules = noProxy.split(/[\s,]+/);

  for (const rule of rules) {
    const ruleMatch = rule.replace(/^(?<leadingDot>\.)/, '*').match(/^(?<hostname>.+?)(?::(?<port>\d+))?$/);

    if (!ruleMatch || !ruleMatch.groups) {
      throw new _errors.UnexpectedStateError('Invalid NO_PROXY pattern.');
    }

    if (!ruleMatch.groups.hostname) {
      throw new _errors.UnexpectedStateError('NO_PROXY entry pattern must include hostname. Use * to match any hostname.');
    }

    const hostnameIsMatch = _matcher.default.isMatch(subjectUrlTokens.hostname, ruleMatch.groups.hostname);

    if (hostnameIsMatch && (!ruleMatch.groups || !ruleMatch.groups.port || subjectUrlTokens.port && subjectUrlTokens.port === ruleMatch.groups.port)) {
      return true;
    }
  }

  return false;
};

var _default = isUrlMatchingNoProxy;
exports.default = _default;
//# sourceMappingURL=isUrlMatchingNoProxy.js.map