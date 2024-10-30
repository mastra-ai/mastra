import { LogConfig, LogLevel, LogProvider } from '@mastra/core';
import * as fs from 'fs';
import path from 'path';

import { capitalizeFirstLetter } from '@/lib/string';

import { FileEnvService } from './service.fileEnv';

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

  async addIntegration(
    integrationName: string,
    integrationConfigString: string,
    isUserDefined: boolean | undefined,
  ): Promise<void> {
    try {
      let data = await this.readFile();

      const intImporter = `${capitalizeFirstLetter(integrationName)}Integration`;

      const path = isUserDefined
        ? `./integrations/${integrationName.toLowerCase()}`
        : `@mastra/${integrationName.toLowerCase()}`;

      // Add import statement
      const importStatement = `import { ${intImporter} } from '${path}'\n`;

      const isIntegrationIncluded = data.includes(`new ${intImporter}(`);

      if (!isIntegrationIncluded) {
        data = importStatement + data;

        // Add integration to config
        const intCode = `new ${intImporter}(${integrationConfigString}),\n`;
        const intArrayIndex = data.indexOf('integrations: [') + 'integrations: ['.length;
        const updatedData = [data.slice(0, intArrayIndex), '\n    ' + intCode, data.slice(intArrayIndex)].join('');

        await this.writeFile(updatedData);
        console.log(`${integrationName} added to config.`);
        return;
      }
      console.log(`${integrationName} already exists in config.`);
    } catch (err) {
      console.error(`Error adding integration: ${err}`);
    }
  }

  async removeIntegration(integrationName: string): Promise<void> {
    try {
      let data = await this.readFile();

      // Remove import statement
      const importStatement = `import { ${integrationName} } from '@mastra/${integrationName.toLowerCase()}'\n`;
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

  async checkIfVectorProviderExists(providerName: string): Promise<boolean> {
    try {
      const data = await this.readFile();

      const vectorProviderRegex = /vectorProvider:\s*\[([\s\S]*?)\]/;
      const match = data.match(vectorProviderRegex);

      if (match) {
        const existingProviders = match[1].trim();
        const providerRegex = new RegExp(`\\{\\s*name:\\s*['"]${providerName}['"],[\\s\\S]*?\\}`);
        return providerRegex.test(existingProviders);
      }

      return false;
    } catch (err) {
      console.error(`Error checking vector provider existence: ${err}`);
      return false;
    }
  }

  async updateVectorProvider({ providerName, apiKey }: { providerName: string; apiKey: string }): Promise<void> {
    try {
      const providerExists = await this.checkIfVectorProviderExists(providerName.toUpperCase());

      if (providerExists) {
        return;
      }

      let data = await this.readFile();

      const newProviderConfig = `{
      name: '${providerName}',
      provider: '${providerName}',
      apiKey: process.env.${apiKey}!,
      dirPath: '/mastra/vector-configs',
    }`;

      const vectorProviderRegex = /vectorProvider:\s*\[([\s\S]*?)\]/;
      const match = data.match(vectorProviderRegex);

      if (match) {
        const existingProviders = match[1].trim();
        const providerRegex = new RegExp(`\\{\\s*providerName:\\s*['"]${providerName}['"],[\\s\\S]*?\\}`);
        const providerMatch = existingProviders.match(providerRegex);

        if (providerMatch) {
          // Update existing provider
          const updatedProviders = existingProviders.replace(providerRegex, newProviderConfig);
          const updatedVectorProvider = `vectorProvider: [${updatedProviders}]`;
          data = data.replace(vectorProviderRegex, updatedVectorProvider);
        } else {
          // Add new provider
          const updatedProviders = existingProviders
            ? `${existingProviders},\n    ${newProviderConfig}`
            : newProviderConfig;
          const updatedVectorProvider = `vectorProvider: [${updatedProviders}]`;
          data = data.replace(vectorProviderRegex, updatedVectorProvider);
        }
      } else {
        // Create new vectorProvider array
        const agentsRegex = /agents:\s*{([^}]*)}/;
        const agentsMatch = data.match(agentsRegex);
        if (agentsMatch) {
          const updatedAgents = `agents: {${agentsMatch[1]},
    vectorProvider: [${newProviderConfig}]
  }`;
          data = data.replace(agentsRegex, updatedAgents);
        } else {
          throw new Error('Unable to find agents configuration in the file.');
        }
      }

      await this.writeFile(data);
      console.log(`Vector provider ${providerName} updated in config.`);
    } catch (err) {
      console.error(`Error updating vector provider: ${err}`);
    }
  }

  async updateLogsConfig(logsConfig: LogConfig): Promise<void> {
    let data = await this.readFile();

    let configString = '';
    if (logsConfig.provider === 'UPSTASH') {
      //call the envwriter service
      //and write the envs to it
      const envFilePath = path.join(process.cwd(), '.env');
      const envWriter = new FileEnvService(envFilePath);
      await envWriter.setEnvValue('UPSTASH_URL', logsConfig.config?.url || '');
      await envWriter.setEnvValue('UPSTASH_API_KEY', logsConfig.config?.token || '');

      configString = `logs: {
    provider: '${logsConfig.provider}',
    config: {
      url: process.env.UPSTASH_URL!,
      token: process.env.UPSTASH_API_KEY!
    },
    level: LogLevel.${LogLevel[logsConfig.level!]}
  }`;
    } else {
      configString = `logs: {
    provider: '${logsConfig.provider}',
    level: LogLevel.${LogLevel[logsConfig.level!]}
  }`;
    }

    const logsRegex = /logs:\s*{(?:[^{}]|{[^{}]*})*}/;
    // Replace the existing logs config with the new one
    data = data.replace(logsRegex, configString);
    await this.writeFile(data);
  }

  async getLogsConfig(): Promise<{
    provider: LogProvider;
    level: string;
  }> {
    let data = await this.readFile();
    const logsRegex = /logs:\s*({(?:[^{}]|{[^{}]*})*})/;
    const logsMatch = data.match(logsRegex);

    if (!logsMatch) {
      return {
        provider: 'FILE',
        level: 'LogLevel.DEBUG',
      };
    }

    const logs = logsMatch[0];

    const provider = logs.match(/provider:\s*'([^']*)'/)![1] as LogProvider;
    const level = logs.match(/level:\s*(LogLevel\.[A-Z]+)/)![1] as string;

    return {
      provider,
      level,
    };
  }
}
