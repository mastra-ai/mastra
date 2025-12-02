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

export { shouldSkipPackage };
