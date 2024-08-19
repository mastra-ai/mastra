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

  async addPlugin(pluginName: string, pluginConfigString: string): Promise<void> {
    try {
      let data = await this.readFile();

      const pluginImporter = `${pluginName}Integration`;

      // Add import statement
      const importStatement = `import { ${pluginImporter} } from 'future-${pluginName.toLowerCase()}'\n`;
      if (!data.includes(importStatement)) {
        data = importStatement + data;
      }

      // Add plugin to config
      const pluginCode = `new ${pluginImporter}(${pluginConfigString}),\n`;
      const pluginsArrayIndex = data.indexOf('plugins: [') + 'plugins: ['.length;
      const updatedData = [data.slice(0, pluginsArrayIndex), '\n    ' + pluginCode, data.slice(pluginsArrayIndex)].join(
        '',
      );

      await this.writeFile(updatedData);
      console.log(`${pluginName} added to config.`);
    } catch (err) {
      console.error(`Error adding plugin: ${err}`);
    }
  }

  async removePlugin(pluginName: string): Promise<void> {
    try {
      let data = await this.readFile();

      // Remove import statement
      const importStatement = `import { ${pluginName} } from 'future-${pluginName.toLowerCase()}'\n`;
      data = data.replace(importStatement, '');

      // Remove plugin from config
      const pluginRegex = new RegExp(`new ${pluginName}\\(\\{[\\s\\S]*?\\}\\),?\\s*`, 'g');
      data = data.replace(pluginRegex, '');

      await this.writeFile(data);
      console.log(`${pluginName} removed from config.`);
    } catch (err) {
      console.error(`Error removing plugin: ${err}`);
    }
  }
}
