import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import fsExtra from 'fs-extra/esm';

/**
 *
 * @param inputFile the file in the starter files directory to copy
 * @param outputFilePath the destination path
 * @param replaceIfExists flag to replace if it exists
 * @returns
 */
export async function copyStarterFile(inputFile: string, outputFilePath: string, replaceIfExists?: boolean) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, '..', 'starter-files', inputFile);
  const fileString = fs.readFileSync(filePath, 'utf8');

  if (fs.existsSync(outputFilePath) && !replaceIfExists) {
    console.log(`${outputFilePath} already exists`);
    return false;
  }

  await fsExtra.outputFile(outputFilePath, fileString);

  return true;
}
