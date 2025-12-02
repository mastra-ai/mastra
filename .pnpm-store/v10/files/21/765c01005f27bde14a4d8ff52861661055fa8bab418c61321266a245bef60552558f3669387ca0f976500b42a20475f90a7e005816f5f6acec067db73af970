'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function getVersionRangeType(versionRange) {
  if (versionRange.charAt(0) === "^") return "^";
  if (versionRange.charAt(0) === "~") return "~";
  if (versionRange.startsWith(">=")) return ">=";
  if (versionRange.startsWith("<=")) return "<=";
  if (versionRange.charAt(0) === ">") return ">";
  return "";
}

exports["default"] = getVersionRangeType;
