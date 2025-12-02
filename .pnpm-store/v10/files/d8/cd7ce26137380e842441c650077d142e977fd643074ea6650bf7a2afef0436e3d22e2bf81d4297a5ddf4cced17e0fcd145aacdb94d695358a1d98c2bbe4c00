// src/versionSelector.ts
var versionSelector = (clerkJSVersion, packageVersion = "5.102.0") => {
  if (clerkJSVersion) {
    return clerkJSVersion;
  }
  const prereleaseTag = getPrereleaseTag(packageVersion);
  if (prereleaseTag) {
    if (prereleaseTag === "snapshot") {
      return "5.102.0";
    }
    return prereleaseTag;
  }
  return getMajorVersion(packageVersion);
};
var getPrereleaseTag = (packageVersion) => packageVersion.trim().replace(/^v/, "").match(/-(.+?)(\.|$)/)?.[1];
var getMajorVersion = (packageVersion) => packageVersion.trim().replace(/^v/, "").split(".")[0];

export {
  versionSelector,
  getMajorVersion
};
//# sourceMappingURL=chunk-H7LOAF6V.mjs.map