import * as fs from 'fs';
import * as path from 'path';

import { AgentInfo, ToolChoice } from '@/domains/agents/context/agent-form-context';

import first from 'lodash/first';
import last from 'lodash/last';

export interface Agent extends Omit<AgentInfo, 'model'> {
  id: string;
  model: AgentInfo['model'] & {
    toolChoice: ToolChoice;
  };
  tools: { [key: string]: boolean };
}

interface AgentDto {}

export class AgentWriterService {
  private directoryPath: string;

  constructor(directoryPath: string) {
    this.directoryPath = directoryPath;
  }

  async readAgent(filePath: string): Promise<Agent> {
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

  async writeAgent(filePath: string, data: AgentDto): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getAgents(): Promise<Agent[]> {
    return new Promise((resolve, reject) => {
      fs.readdir(this.directoryPath, async (err, files) => {
        if (err) reject(err);
        else {
          const jsonFiles = files.filter(file => file.endsWith('.json'));
          const result = [];
          for (const file of jsonFiles) {
            const filePath = path.join(this.directoryPath, file);
            const jsonData = await this.readAgent(filePath);
            if (jsonData.name) {
              const file = last(filePath?.split('/'))!;
              const id = first(file?.split('.json'))!;
              result.push({ ...jsonData, id });
            }
          }
          resolve(result);
        }
      });
    });
  }

  async deleteAgent(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.unlink(filePath, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
