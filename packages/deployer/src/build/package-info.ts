/**
 * Note: This function depends on local-pkg and should only be used at build-time.
 * It is in a separate file to avoid including local-pkg in runtime code.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { getPackageInfo } from 'local-pkg';

/**
 * Get package root path
 */
export async function getPackageRootPath(packageName: string, parentPath?: string): Promise<string | null> {
  let rootPath: string | null;

  try {
    let options: { paths?: string[] } | undefined = undefined;
    if (parentPath) {
      if (!parentPath.startsWith('file://')) {
        parentPath = pathToFileURL(parentPath).href;
      }

      options = {
        paths: [parentPath],
      };
    }

    const pkg = await getPackageInfo(packageName, options);
    const pkgRootPath = pkg?.rootPath as string | URL | undefined;
    if (typeof pkgRootPath === 'string') {
      rootPath = pkgRootPath;
    } else if (pkgRootPath instanceof URL) {
      rootPath = fileURLToPath(pkgRootPath);
    } else {
      rootPath = null;
    }
  } catch {
    rootPath = null;
  }

  return rootPath;
}
