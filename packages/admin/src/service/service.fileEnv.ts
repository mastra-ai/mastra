import * as fs from 'fs';
import path from 'path';

import { EnvService } from './service.env';

const fsExtra = require('fs-extra');

export class FileEnvService extends EnvService {
  private filePath: string;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  private readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err: NodeJS.ErrnoException | null, data: string) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  private writeFile({ filePath, data }: { filePath: string; data: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, data, 'utf8', (err: NodeJS.ErrnoException | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async updateEnvData({
    key,
    value,
    filePath = this.filePath,
    data,
  }: {
    key: string;
    value: string;
    filePath?: string;
    data: string;
  }): Promise<string> {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (data.match(regex)) {
      data = data.replace(regex, `${key}=${value}`);
    } else {
      data += `\n${key}=${value}`;
    }
    await this.writeFile({ filePath, data });
    console.log(`${key} set to ${value} in ENV file.`);
    return data;
  }

  async getEnvValue(key: string): Promise<string | null> {
    try {
      const data = await this.readFile(this.filePath);
      const regex = new RegExp(`^${key}=(.*)$`, 'm');
      const match = data.match(regex);
      return match ? match[1] : null;
    } catch (err) {
      console.error(`Error reading ENV value: ${err}`);
      return null;
    }
  }

  async setEnvValue(key: string, value: string): Promise<void> {
    try {
      const adminEnvData = await this.readFile(this.filePath);
      const mastraWorkingDirectoryPath = process.env.APP_DIR;

      // Update admin console .env file
      await this.updateEnvData({ key, value, data: adminEnvData });

      // Update user project .env file
      if (mastraWorkingDirectoryPath) {
        const userProjectEnvFilePath = path.join(mastraWorkingDirectoryPath, '.env');
        await fsExtra.ensureFile(userProjectEnvFilePath);
        let userProjectEnvData = await this.readFile(userProjectEnvFilePath);
        await this.updateEnvData({ key, value, filePath: userProjectEnvFilePath, data: userProjectEnvData });
      }
    } catch (err) {
      console.error(`Error writing ENV value: ${err}`);
    }
  }
}
