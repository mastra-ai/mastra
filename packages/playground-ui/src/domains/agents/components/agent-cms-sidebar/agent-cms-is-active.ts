export function isActive(basePath: string, currentPath: string, pathSuffix: string): boolean {
  const fullPath = basePath + pathSuffix;

  if (pathSuffix === '') {
    return currentPath === basePath || currentPath === basePath + '/';
  }

  return currentPath.startsWith(fullPath);
}
