import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function toImportSpecifier(fromDir: string, target: string): string {
  const relative = path.relative(fromDir, target).replaceAll(path.sep, '/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

describe('AgentExecutionOptions with strictNullChecks disabled', () => {
  it('does not require structuredOutput when OUTPUT is undefined', async () => {
    const fixtureDir = await mkdtemp(path.join(tmpdir(), 'mastra-agent-options-nonstrict-'));
    const sourcePath = path.join(fixtureDir, 'repro.ts');
    const agentTypesPath = path.resolve(__dirname, '../agent.types.ts');
    const importSpecifier = toImportSpecifier(fixtureDir, agentTypesPath);

    await writeFile(
      sourcePath,
      `
        import type { AgentExecutionOptions, PublicAgentExecutionOptions } from '${importSpecifier}';

        const executionOptions: AgentExecutionOptions<undefined> = {
          providerOptions: { openai: { reasoningEffort: 'low' as const } },
        };

        const publicOptions: PublicAgentExecutionOptions<undefined> = {
          maxSteps: 50,
        };

        void executionOptions;
        void publicOptions;
      `,
    );

    try {
      const program = ts.createProgram([sourcePath], {
        allowImportingTsExtensions: true,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
        module: ts.ModuleKind.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        skipLibCheck: true,
        strict: false,
        strictNullChecks: false,
        target: ts.ScriptTarget.ES2022,
        types: ['node'],
      });

      const diagnostics = ts
        .getPreEmitDiagnostics(program)
        .filter(diagnostic => diagnostic.file?.fileName === sourcePath);
      const messages = diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

      expect(messages).toEqual([]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
