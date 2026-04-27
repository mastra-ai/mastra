import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildTemporalWorkflowModule, buildWorkflowEntryModuleFromRegistry } from './transforms/workflows';
import type { WorkflowExportRegistry } from './webpack-plugin';

export interface MastraTemporalLoaderOptions {
  entryFile?: string;
  debugOutputDir?: string | null;
  registry?: WorkflowExportRegistry;
}

async function writeDebugModule(
  resourcePath: string,
  code: string,
  options: MastraTemporalLoaderOptions,
): Promise<void> {
  if (!options.debugOutputDir) {
    return;
  }

  const baseDir = options.entryFile ? path.dirname(options.entryFile) : process.cwd();
  const relativePath = path.relative(baseDir, resourcePath);
  const safeRelativePath = relativePath.startsWith('..') ? path.basename(resourcePath) : relativePath;
  const outputPath = path.join(options.debugOutputDir, 'modules', safeRelativePath);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, code, 'utf-8');
}

export default function mastraTemporalWorkflowLoader(this: any, source: string): void {
  const callback = this.async();
  if (!callback) {
    throw new Error('mastra-temporal-webpack-loader requires async mode');
  }

  const options: MastraTemporalLoaderOptions = this.getOptions?.() ?? {};

  const transform = async (): Promise<string> => {
    if (options.entryFile && this.resourcePath === options.entryFile) {
      if (!options.registry) {
        return source;
      }

      return buildWorkflowEntryModuleFromRegistry(source, this.resourcePath, options.registry.asMap());
    }

    if (!source.includes('createWorkflow')) {
      return source;
    }

    const result = await buildTemporalWorkflowModule(source, this.resourcePath, options);
    options.registry?.register(
      this.resourcePath,
      result.workflows.map(workflow => workflow.exportName),
    );
    return result.code;
  };

  transform()
    .then(async code => {
      await writeDebugModule(this.resourcePath, code, options);
      callback(null, code);
    })
    .catch((err: unknown) => callback(err));
}
