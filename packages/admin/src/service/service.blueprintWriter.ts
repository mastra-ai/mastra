import * as fs from 'fs';
import * as path from 'path';

import { AutomationBlueprint, UpdateAutomationBlueprintDto } from 'core/src/workflows/types';
import first from 'lodash/first';
import last from 'lodash/last';

export class BlueprintWriterService {
  private directoryPath: string;

  constructor(directoryPath: string) {
    this.directoryPath = directoryPath;
  }

  async readBlueprint(filePath: string): Promise<AutomationBlueprint> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) reject(err);
        else {
          const jsonData = JSON.parse(data);
          const blueprintFile = last(filePath?.split('/'))!;
          const blueprintId = first(blueprintFile?.split('.json'))!;
          resolve({ ...jsonData, id: blueprintId });
        }
      });
    });
  }

  // TODO: Fix Blueprint data type.
  async writeBlueprint(filePath: string, data: UpdateAutomationBlueprintDto): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // TODO: Fix Blueprint data type.
  async getBlueprints(): Promise<AutomationBlueprint[]> {
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
              const blueprintFile = last(filePath?.split('/'))!;
              const blueprintId = first(blueprintFile?.split('.json'))!;
              result.push({ ...jsonData, id: blueprintId });
            }
          }
          resolve(result);
        }
      });
    });
  }
}
