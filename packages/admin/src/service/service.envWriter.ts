import * as fs from 'fs';

export class EnvWriterService {
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

  async getEnvValue(key: string): Promise<string | null> {
    try {
      const data = await this.readFile();
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
      let data = await this.readFile();
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (data.match(regex)) {
        data = data.replace(regex, `${key}=${value}`);
      } else {
        data += `\n${key}=${value}`;
      }
      await this.writeFile(data);
      console.log(`${key} set to ${value} in ENV file.`);
    } catch (err) {
      console.error(`Error writing ENV value: ${err}`);
    }
  }
}
