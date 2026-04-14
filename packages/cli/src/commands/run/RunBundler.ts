import { FileService } from '@mastra/deployer/build';

import { BuildBundler } from '../build/BuildBundler.js';
import { shouldSkipDotenvLoading } from '../utils.js';

export interface RunEntryOptions {
  prompt: string;
  agentId: string;
  outputFormat: 'text' | 'json' | 'stream-json';
  jsonSchema?: string;
  strict: boolean;
}

export class RunBundler extends BuildBundler {
  private customEnvFile?: string;
  private entryOptions: RunEntryOptions;

  constructor(entryOptions: RunEntryOptions, customEnvFile?: string) {
    super({ studio: false });
    this.entryOptions = entryOptions;
    this.customEnvFile = customEnvFile;
  }

  override getEnvFiles(): Promise<string[]> {
    if (shouldSkipDotenvLoading()) {
      return Promise.resolve([]);
    }

    const possibleFiles = ['.env.development', '.env.local', '.env'];
    if (this.customEnvFile) {
      possibleFiles.unshift(this.customEnvFile);
    }

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);
      return Promise.resolve([envFile]);
    } catch {
      // ignore
    }

    return Promise.resolve([]);
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, { outputDirectory, projectRoot }, toolsPaths);
  }

  protected override getEntry(): string {
    const { prompt, agentId, outputFormat, jsonSchema, strict } = this.entryOptions;

    const escapedPrompt = JSON.stringify(prompt);
    const escapedAgentId = JSON.stringify(agentId);
    const escapedFormat = JSON.stringify(outputFormat);
    const schemaArg = jsonSchema ? JSON.stringify(jsonSchema) : 'undefined';

    return `
    import { mastra } from '#mastra';
    import { runHeadless } from '@mastra/core/harness';
    import process from 'node:process';

    runHeadless(mastra, {
      prompt: ${escapedPrompt},
      agentId: ${escapedAgentId},
      outputFormat: ${escapedFormat},
      jsonSchema: ${schemaArg},
      strict: ${strict},
    }, {
      stdout: process.stdout,
      stderr: process.stderr,
      exit: (code) => process.exit(code),
      onSigint: (handler) => process.on('SIGINT', handler),
    }).catch((err) => {
      process.stderr.write('Fatal: ' + (err.message || String(err)) + '\\n');
      process.exit(1);
    });
    `;
  }
}
