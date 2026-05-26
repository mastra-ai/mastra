import * as fs from 'node:fs/promises';

export abstract class EnvService {
  abstract getEnvValue(key: string): Promise<string | null>;
  abstract setEnvValue(key: string, value: string): Promise<void>;
}

export class FileEnvService extends EnvService {
  private readonly filePath: string;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
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
    const updated = data.match(regex) ? data.replace(regex, `${key}=${value}`) : `${data}\n${key}=${value}`;

    await fs.writeFile(filePath, updated, 'utf8');
    console.info(`${key} set to ${value} in ENV file.`);
    return updated;
  }

  async getEnvValue(key: string): Promise<string | null> {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const regex = new RegExp(`^${key}=(.*)$`, 'm');
      const match = data.match(regex);
      return match?.[1] ?? null;
    } catch (err) {
      console.error(`Error reading ENV value: ${err}`);
      return null;
    }
  }

  async setEnvValue(key: string, value: string): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      await this.updateEnvData({ key, value, data });
    } catch (err) {
      console.error(`Error writing ENV value: ${err}`);
    }
  }
}
