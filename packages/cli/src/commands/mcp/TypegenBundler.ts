import { FileService } from '@mastra/deployer/build';

import { BuildBundler } from '../build/BuildBundler.js';
import { shouldSkipDotenvLoading } from '../utils.js';

export const TYPEGEN_RESULT_MARKER = '__MASTRA_MCP_TYPEGEN_RESULT__';

export class TypegenBundler extends BuildBundler {
  private customEnvFile?: string;
  private clientExport?: string;

  constructor({ customEnvFile, clientExport }: { customEnvFile?: string; clientExport?: string } = {}) {
    super({ studio: false });
    this.customEnvFile = customEnvFile;
    this.clientExport = clientExport;
  }

  override getEnvFiles(): Promise<string[]> {
    // Skip loading .env files if MASTRA_SKIP_DOTENV is set
    if (shouldSkipDotenvLoading()) {
      return Promise.resolve([]);
    }

    const possibleFiles = ['.env', '.env.local', '.env.development'];
    if (this.customEnvFile) {
      const customEnvFiles = new FileService().getExistingFiles([this.customEnvFile]);
      if (customEnvFiles.length > 0) return Promise.resolve(customEnvFiles);
    }

    return Promise.resolve(new FileService().getExistingFiles(possibleFiles));
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, { outputDirectory, projectRoot }, toolsPaths);
  }

  protected override getEntry(): string {
    return `
    import * as entryModule from '#mastra';
    import { generateToolTypes } from '@mastra/mcp';

    const CLIENT_EXPORT = ${JSON.stringify(this.clientExport ?? null)};
    const MARKER = ${JSON.stringify(TYPEGEN_RESULT_MARKER)};

    function report(result) {
      console.log(MARKER + JSON.stringify(result));
    }

    function isMCPClient(value) {
      return (
        value !== null &&
        typeof value === 'object' &&
        typeof value.listToolDefinitions === 'function' &&
        typeof value.disconnect === 'function'
      );
    }

    async function runTypegen() {
      const clients = Object.entries(entryModule).filter(([, value]) => isMCPClient(value));
      const selected = CLIENT_EXPORT ? clients.filter(([name]) => name === CLIENT_EXPORT) : clients;

      if (selected.length === 0) {
        report({
          success: false,
          message: CLIENT_EXPORT
            ? 'No MCPClient export named "' + CLIENT_EXPORT + '" was found in your Mastra entry file.'
            : 'No MCPClient exports were found in your Mastra entry file. Export your MCPClient instance from it (e.g. export const mcp = new MCPClient({...})), or pass --client <exportName>.',
          scannedExports: Object.keys(entryModule),
        });
        process.exit(1);
      }

      const warnings = [];
      const catalog = {};

      try {
        for (const [exportName, client] of selected) {
          const definitions = await client.listToolDefinitions();
          for (const [serverName, tools] of Object.entries(definitions)) {
            if (catalog[serverName]) {
              warnings.push('Server "' + serverName + '" is configured on multiple MCPClient exports; using the catalog from "' + exportName + '".');
            }
            catalog[serverName] = tools;
          }
        }

        const code = await generateToolTypes(catalog);
        report({ success: true, code, warnings });
      } catch (error) {
        report({
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error during MCP type generation',
          warnings,
        });
        process.exitCode = 1;
      } finally {
        await Promise.allSettled(selected.map(([, client]) => client.disconnect()));
      }

      process.exit(process.exitCode ?? 0);
    }

    runTypegen();
    `;
  }
}
