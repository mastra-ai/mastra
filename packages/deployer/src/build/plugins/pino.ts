import path from 'path';
import type { OutputChunk, Plugin } from 'rollup';

export function pino() {
  let emittedChunks = new Map();

  const workerFiles = [
    {
      id: 'thread-stream-worker',
      file: 'pino-thread-stream-worker',
    },
    {
      id: 'pino-worker',
      file: 'pino-worker',
    },
    {
      id: 'pino/file',
      file: 'pino-file',
    },
    {
      id: 'pino-pretty',
      file: 'pino-pretty',
    },
  ];

  const fileReferences = new Map();
  return {
    name: 'rollup-plugin-pino',

    async resolveId(id, importee) {
      if (workerFiles.some(file => file.id === id)) {
        return {
          id,
          external: true,
          moduleSideEffects: false,
        };
      }

      if (id === 'pino') {
        // resolve pino first
        const resolvedPino = await this.resolve(id, importee);

        if (resolvedPino) {
          await Promise.all(
            workerFiles.map(async file => {
              const resolvedEntry = await this.resolve(file.id, resolvedPino.id);

              if (!resolvedEntry) {
                return null;
              }

              const reference = this.emitFile({
                type: 'chunk',
                id: resolvedEntry.id,
                name: `${file.file}`,
                importer: resolvedPino.id,
              });

              fileReferences.set(file.id, reference);
            }),
          );
        }
      }
    },
    renderChunk(code, chunk) {
      debugger;
      if (chunk.type === 'chunk' && (chunk as OutputChunk).isEntry && fileReferences.size && chunk.name === 'index') {
        const importRegex = /^(?:import(?:["'\s]*[\w*${}\n\r\t, ]+from\s*)?["'\s].+[;"'\s]*)$/gm;

        const codeToInject = `globalThis.__bundlerPathsOverrides = {
            ${Array.from(fileReferences.entries())
              .map(([key, file]) => {
                return '"' + key + '": import.meta.ROLLUP_FILE_URL_' + file;
              })
              .join(',\n')}
            };`;

        // Find all import matches
        const matches = Array.from(code.matchAll(importRegex));

        if (matches.length > 0) {
          // Get the last import's position
          const lastImport = matches[matches.length - 1]!;
          const lastImportEnd = lastImport.index + lastImport[0].length;

          // Insert the code after the last import with a newline
          const newCode = code.slice(0, lastImportEnd) + '\n\n' + codeToInject + '\n\n' + code.slice(lastImportEnd);

          return {
            code: newCode,
            map: null,
          };
        }

        // If no imports found, inject at the start of the file
        return {
          code: `${codeToInject}\n\n${code}`,
          map: null,
        };
      }
    },
  } satisfies Plugin;
}
