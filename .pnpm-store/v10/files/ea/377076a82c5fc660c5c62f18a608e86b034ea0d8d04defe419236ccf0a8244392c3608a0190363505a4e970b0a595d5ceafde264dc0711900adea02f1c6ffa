'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function shouldSkipPackage({
  packageJson
}, {
  ignore,
  allowPrivatePackages
}) {
  if (ignore.includes(packageJson.name)) {
    return true;
  }

  if (packageJson.private && !allowPrivatePackages) {
    return true;
  }

  return !packageJson.version;
}

exports.shouldSkipPackage = shouldSkipPackage;
