import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import fsExtra from 'fs-extra/esm';

import { FileEnvService } from './env.js';

export class FileService {
  /**
   *
   * @param inputFile the file in the starter files directory to copy
   * @param outputFilePath the destination path
   * @param replaceIfExists flag to replace if it exists
   * @returns
   */
  public async copyStarterFile(inputFile: string, outputFilePath: string, replaceIfExists?: boolean) {
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

  public async setupEnvFile({ dbUrl }: { dbUrl: string }) {
    const envPath = path.join(process.cwd(), '.env.development');

    await fsExtra.ensureFile(envPath);

    const fileEnvService = new FileEnvService(envPath);
    await fileEnvService.setEnvValue('DB_URL', dbUrl);
  }

  public getFirstExistingFile(files: string[]): string {
    for (const f of files) {
      if (fs.existsSync(f)) {
        return f;
      }
    }

    throw new Error('Missing required file, checked the following paths: ' + files.join(', '));
  }

  public replaceValuesInFile({
    filePath,
    replacements,
  }: {
    filePath: string;
    replacements: { search: string; replace: string }[];
  }) {
    let fileContent = fs.readFileSync(filePath, 'utf8');
    replacements.forEach(({ search, replace }) => {
      fileContent = fileContent.replaceAll(search, replace);
    });

    fs.writeFileSync(filePath, fileContent);
  }
}
