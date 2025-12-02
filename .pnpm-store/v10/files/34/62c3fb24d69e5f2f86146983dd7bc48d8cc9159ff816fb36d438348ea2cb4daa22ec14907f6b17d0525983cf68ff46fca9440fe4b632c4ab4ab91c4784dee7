function getVersionRangeType(versionRange) {
  if (versionRange.charAt(0) === "^") return "^";
  if (versionRange.charAt(0) === "~") return "~";
  if (versionRange.startsWith(">=")) return ">=";
  if (versionRange.startsWith("<=")) return "<=";
  if (versionRange.charAt(0) === ">") return ">";
  return "";
}

export { getVersionRangeType as default };
