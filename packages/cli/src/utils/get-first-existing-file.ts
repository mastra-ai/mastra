import fs from 'fs';

export const getFirstExistingFile = (files: string[]): string => {
  for (const f of files) {
    if (fs.existsSync(f)) {
      return f;
    }
  }

  throw new Error('Missing required file, checked the following paths: ' + files.join(', '));
};
