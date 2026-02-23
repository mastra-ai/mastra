import * as fs from 'node:fs';
import * as path from 'node:path';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getLanguageId } from '../lsp/language.js';
import { lspManager } from '../lsp/manager.js';
import { findWorkspaceRoot } from '../lsp/workspace.js';
import { truncateStringForTokenEstimate } from '../utils/token-estimator.js';
import { sharedFileEditor } from './file-editor.js';
import { assertPathAllowed, getAllowedPathsFromContext } from './utils.js';

export const stringReplaceLspTool = createTool({
  id: 'string_replace_lsp',
  description: `Edit a file by replacing exact text matches. Returns Language Server Protocol (LSP) diagnostics to show any errors/warnings introduced by your edit.

Usage notes:
- You MUST use the view tool to read a file before editing it. Never edit blind.
- old_str must be an exact substring of the file's current content. Include enough surrounding context to uniquely identify the location.
- If old_str is not found or matches multiple locations, the edit will fail. Provide more context to disambiguate.
- new_str replaces old_str. If new_str is omitted or empty, old_str is deleted.
- Use start_line to narrow the search to a specific region of the file.
- After editing, real LSP diagnostics are returned (TypeScript errors, linting warnings, etc).
- For creating NEW files, use the write_file tool instead.`,
  // requireApproval: true,
  inputSchema: z.object({
    path: z.string(),
    old_str: z.string(),
    new_str: z.string().optional(),
    start_line: z.number().optional(),
  }),
  async execute(context, toolContext) {
    const { path: filePath, old_str, new_str, start_line } = context;

    try {
      // Convert relative paths to absolute (same logic as validatePath in utils.ts)
      const absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

      // Security: ensure the path is within the project root or allowed paths
      const root = process.cwd();
      const allowedPaths = getAllowedPathsFromContext(toolContext);
      assertPathAllowed(absoluteFilePath, root, allowedPaths);

      // Call the FileEditor strReplace method
      const result = await sharedFileEditor.strReplace({
        path: filePath,
        old_str,
        new_str: new_str || '',
        start_line,
      });

      // Get LSP diagnostics
      let diagnosticOutput = '';
      try {
        const workspaceRoot = findWorkspaceRoot(absoluteFilePath);
        const client = await lspManager.getClient(absoluteFilePath, workspaceRoot);
        if (client) {
          // Read the modified file content
          const contentNew = fs.readFileSync(absoluteFilePath, 'utf-8');
          const languageId = getLanguageId(absoluteFilePath) || path.extname(absoluteFilePath).slice(1);

          client.notifyOpen(absoluteFilePath, contentNew, languageId);
          client.notifyChange(absoluteFilePath, contentNew, 1);

          const diagnostics = await client.waitForDiagnostics(absoluteFilePath, 3000).catch(() => []);

          if (diagnostics.length > 0) {
            // Deduplicate diagnostics by location + message
            const seen = new Set<string>();
            const dedup = diagnostics.filter(d => {
              const key = `${d.severity}:${d.range.start.line}:${d.range.start.character}:${d.message}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

            const errors = dedup.filter(d => d.severity === 1);
            const warnings = dedup.filter(d => d.severity === 2);
            const info = dedup.filter(d => d.severity === 3);
            const hints = dedup.filter(d => d.severity === 4);

            const formatDiags = (items: typeof dedup) =>
              items.map(d => `  ${d.range.start.line + 1}:${d.range.start.character + 1} - ${d.message}`).join('\n');

            let diagnosticText = '';
            if (errors.length > 0) {
              diagnosticText += `\nErrors:\n${formatDiags(errors)}`;
            }
            if (warnings.length > 0) {
              diagnosticText += `\nWarnings:\n${formatDiags(warnings)}`;
            }
            if (info.length > 0) {
              diagnosticText += `\nInfo:\n${formatDiags(info)}`;
            }
            if (hints.length > 0) {
              diagnosticText += `\nHints:\n${formatDiags(hints)}`;
            }

            if (diagnosticText) {
              diagnosticOutput = truncateStringForTokenEstimate(`\n\nLSP Diagnostics:${diagnosticText}`, 500, false);
            }
          } else {
            diagnosticOutput = `\n\nLSP Diagnostics:\nNo errors or warnings`;
          }
        }
      } catch {
        // LSP errors are non-fatal — diagnostics just won't be available
      }

      return {
        content: [
          {
            type: 'text',
            text: result + diagnosticOutput,
          },
        ],
      };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : JSON.stringify(e, null, 2),
      };
    }
  },
});
