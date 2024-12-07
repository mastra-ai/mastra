import fs from 'fs';
import path from 'path';

const findLockFile = (dir: string) => {
  const lockFiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];
  for (const file of lockFiles) {
    if (fs.existsSync(path.join(dir, file))) {
      return file;
    }
  }
  const parentDir = path.resolve(dir, '..');
  if (parentDir !== dir) {
    return findLockFile(parentDir);
  }
  return null;
};

const getPackageManager = () => {
  const lockFile = findLockFile(process.cwd());
  switch (lockFile) {
    case 'pnpm-lock.yaml':
      return 'pnpm';
    case 'package-lock.json':
      return 'npm';
    case 'yarn.lock':
      return 'yarn';
    default: // we will use npm if we can't figure it out
      return 'npm';
  }
};

export default getPackageManager;
