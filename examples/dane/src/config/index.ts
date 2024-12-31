import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export class ConfigManager {
  private configPath: string;

  constructor() {
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.dane');
    this.configPath = path.join(configDir, 'config.json');
    this.ensureConfigExists();
  }

  private ensureConfigExists() {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, JSON.stringify({}, null, 2));
    }
  }

  public get(key: string): string | undefined {
    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      return config[key];
    } catch (error) {
      return undefined;
    }
  }

  public set(key: string, value: string): void {
    try {
      const config = fs.existsSync(this.configPath) ? JSON.parse(fs.readFileSync(this.configPath, 'utf-8')) : {};
      config[key] = value;
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      throw new Error(`Failed to set config value: ${error}`);
    }
  }

  public delete(key: string): void {
    try {
      const config = fs.existsSync(this.configPath) ? JSON.parse(fs.readFileSync(this.configPath, 'utf-8')) : {};
      if (key in config) {
        delete config[key];
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      }
    } catch (error) {
      throw new Error(`Failed to delete config value: ${error}`);
    }
  }

  public list(): Record<string, string> {
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
    } catch (error) {
      return {};
    }
  }

  public getAnthropicApiKey(): string {
    const key = this.get('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      // Check if we're in a command that requires the API key
      const command = process.argv[2] || '';
      const configCommands = ['config', '--help', '-h'];

      // Only throw if we're not in a config-related command
      if (!configCommands.includes(command)) {
        throw new Error(
          'ANTHROPIC_API_KEY not found in config. Please set it using: dane config --set ANTHROPIC_API_KEY=your_key_here',
        );
      }
      return '';
    }
    return key;
  }
}

// Create a singleton instance for easy access
export const config = new ConfigManager();
