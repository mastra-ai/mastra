import * as fs from 'fs';

export class ConfigWriterService {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  readFile(): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(this.filePath, 'utf8', (err: NodeJS.ErrnoException | null, data: string) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  writeFile(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(this.filePath, data, 'utf8', (err: NodeJS.ErrnoException | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async addIntegration(integrationName: string, integrationConfigString: string): Promise<void> {
    try {
      let data = await this.readFile();

      const intImporter = `${integrationName}Integration`;

      // Add import statement
      const importStatement = `import { ${intImporter} } from '@arkw/${integrationName.toLowerCase()}'\n`;
      if (!data.includes(importStatement)) {
        data = importStatement + data;
      }

      // Add integration to config
      const intCode = `new ${intImporter}(${integrationConfigString}),\n`;
      const intArrayIndex = data.indexOf('integrations: [') + 'integrations: ['.length;
      const updatedData = [data.slice(0, intArrayIndex), '\n    ' + intCode, data.slice(intArrayIndex)].join('');

      await this.writeFile(updatedData);
      console.log(`${integrationName} added to config.`);
    } catch (err) {
      console.error(`Error adding integration: ${err}`);
    }
  }

  async removeIntegration(integrationName: string): Promise<void> {
    try {
      let data = await this.readFile();

      // Remove import statement
      const importStatement = `import { ${integrationName} } from 'future-${integrationName.toLowerCase()}'\n`;
      data = data.replace(importStatement, '');

      // Remove integration from config
      const integrationRegex = new RegExp(`new ${integrationName}\\(\\{[\\s\\S]*?\\}\\),?\\s*`, 'g');
      data = data.replace(integrationRegex, '');

      await this.writeFile(data);
      console.log(`${integrationName} removed from config.`);
    } catch (err) {
      console.error(`Error removing integration: ${err}`);
    }
  }
}
