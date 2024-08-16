import * as fs from 'fs';
import * as path from 'path';

export class BlueprintWriterService {
  private directoryPath: string;

  constructor(directoryPath: string) {
    this.directoryPath = directoryPath;
  }

  async readBlueprint(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(JSON.parse(data));
      });
    });
  }

  // TODO: Fix Blueprint data type.
  async writeBlueprint(filePath: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // TODO: Fix Blueprint data type.
  async getBlueprints(): Promise<{ data: any; filePath: string }[]> {
    return new Promise((resolve, reject) => {
      fs.readdir(this.directoryPath, async (err, files) => {
        if (err) reject(err);
        else {
          const jsonFiles = files.filter(file => file.endsWith('.json'));
          const result = [];
          for (const file of jsonFiles) {
            const filePath = path.join(this.directoryPath, file);
            const jsonData = await this.readBlueprint(filePath);
            if (jsonData.title) {
              result.push({ data: jsonData, filePath });
            }
          }
          resolve(result);
        }
      });
    });
  }
}
