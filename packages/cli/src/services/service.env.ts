import * as fs from 'node:fs/promises';

export abstract class EnvService {
  abstract getEnvValue(key: string): Promise<string | null>;
  abstract setEnvValue(key: string, value: string): Promise<void>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class FileEnvService extends EnvService {
  private static readonly ENV_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

  private readonly filePath: string;

  private validateEnvEntry(key: string, value: string): void {
    if (!FileEnvService.ENV_KEY_REGEX.test(key)) {
      throw new Error(`Invalid ENV key: ${key}`);
    }
    if (/[\r\n]/.test(value)) {
      throw new Error(`Invalid ENV value for ${key}: multiline values are not supported.`);
    }
  }

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  private envLineRegex(key: string, captureValue = false): RegExp {
    const pattern = captureValue ? `^${escapeRegExp(key)}=(.*)$` : `^${escapeRegExp(key)}=.*$`;
    return new RegExp(pattern, 'm');
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
    this.validateEnvEntry(key, value);

    const lineRegex = this.envLineRegex(key);
    const updated = lineRegex.test(data)
      ? data.replace(lineRegex, () => `${key}=${value}`)
      : `${data}\n${key}=${value}`;

    await fs.writeFile(filePath, updated, 'utf8');
    console.info(`${key} set in ENV file.`);
    return updated;
  }

  async getEnvValue(key: string): Promise<string | null> {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const match = data.match(this.envLineRegex(key, true));
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
