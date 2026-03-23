/**
 * LSP Inspect Tool
 *
 * Inspect code at a specific position using the Language Server Protocol.
 * The agent provides a file path, line number, and a `<<<` marker in the
 * line content to indicate the cursor position.
 */

import path from 'node:path';
import { z } from 'zod/v4';

import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { requireWorkspace, emitWorkspaceMetadata } from './helpers';

const CURSOR_MARKER = '<<<';

/**
 * Get a single line preview from a file at the specified line number.
 * Returns the trimmed line content, or null if the line cannot be read.
 */
async function getLinePreview(filePath: string, lineNumber: number): Promise<string | null> {
  try {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const line = lines[lineNumber - 1];
    return line?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * Compress a file path by replacing the current working directory prefix with $cwd
 */
function compressPath(filePath: string): string {
  const cwd = process.cwd();
  if (filePath.startsWith(cwd)) {
    return '$cwd' + filePath.slice(cwd.length);
  }
  return filePath;
}

export const lspInspectTool = createTool({
  id: WORKSPACE_TOOLS.LSP.LSP_INSPECT,
  description:
    'Inspect code at a specific symbol position using the Language Server Protocol. ' +
    'Provide an absolute file path, a 1-indexed line number, and the exact line content with <<< marking the cursor position. ' +
    'Exactly one <<< marker is required. ' +
    'Returns hover information, any diagnostics reported on that line, plus definition and implementation locations when available. ' +
    'Use this for type information, symbol navigation, and go-to-definition; use view to read the surrounding implementation.',

  inputSchema: z.object({
    path: z.string().describe('Absolute path to the file'),
    line: z.number().int().positive().describe('Line number (1-indexed)'),
    match: z
      .string()
      .describe(
        'Line content with <<< marking the cursor position. ' +
          'Exactly one <<< marker is required. ' +
          'Example: "const foo = <<<bar()" means cursor is at bar',
      ),
  }),

  execute: async ({ path: filePath, line, match }, context) => {
    const workspace = requireWorkspace(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.LSP.LSP_INSPECT);

    // Parse cursor position from match
    const cursorPositions = [];
    let searchStart = 0;
    while (true) {
      const pos = match.indexOf(CURSOR_MARKER, searchStart);
      if (pos === -1) break;
      cursorPositions.push(pos);
      searchStart = pos + CURSOR_MARKER.length;
    }

    if (cursorPositions.length === 0) {
      return {
        error: `No <<< cursor marker found in match`,
      };
    }

    if (cursorPositions.length > 1) {
      return {
        error: `Multiple <<< markers found (found ${cursorPositions.length}, expected 1)`,
      };
    }

    // 1-indexed character position (LSP uses 1-indexed)
    const character = cursorPositions[0]! + 1;

    // Get the LSP manager
    const lspManager = workspace.lsp;
    if (!lspManager) {
      return {
        error: 'LSP is not configured for this workspace. Enable LSP in workspace config to use this tool.',
      };
    }

    // Resolve absolute path
    const absolutePath =
      workspace.filesystem?.resolveAbsolutePath?.(filePath) ??
      path.resolve(lspManager.root, filePath.replace(/^\/+/, ''));

    let fileContent = '';
    try {
      const fs = await import('node:fs/promises');
      fileContent = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      fileContent = '';
    }

    // Get client and prepare for querying
    let queryResult;
    try {
      queryResult = await lspManager.prepareQuery(absolutePath);
    } catch (err) {
      return {
        error: `Failed to initialize LSP client: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (!queryResult) {
      return {
        error: `No language server available for files of this type: ${filePath}`,
      };
    }

    const { client, uri } = queryResult;

    // LSP uses 0-indexed positions
    const position = { line: line - 1, character: character - 1 };

    // Execute queries - minimal output
    const result: Record<string, unknown> = {};

    try {
      // Primary query: hover
      const hoverResult = await client.queryHover(uri, position);
      if (hoverResult) {
        const contents = hoverResult.contents;
        if (contents) {
          if (typeof contents === 'string') {
            result.hover = { value: contents, kind: 'plaintext' };
          } else if (Array.isArray(contents)) {
            // Usually [MarkupContent] or [string]
            const first = contents[0];
            if (typeof first === 'string') {
              result.hover = { value: first, kind: 'plaintext' };
            } else if (first?.value) {
              result.hover = { value: first.value, kind: first.kind ?? 'markdown' };
            }
          } else if (contents.value) {
            result.hover = { value: contents.value, kind: contents.kind ?? 'markdown' };
          }
        }
      }

      // Secondary queries: diagnostics, definition, and implementation
      const [diagnosticsResult, definitionResult, implResult] = await Promise.all([
        lspManager.getDiagnostics(absolutePath, fileContent).catch(() => []),
        client.queryDefinition(uri, position).catch(() => []),
        client.queryImplementation(uri, position).catch(() => []),
      ]);

      if (diagnosticsResult && diagnosticsResult.length > 0) {
        const lineDiagnostics = diagnosticsResult
          .filter(diagnostic => diagnostic.line === line)
          .map(diagnostic => ({
            severity: diagnostic.severity,
            message: diagnostic.message,
            source: diagnostic.source ?? null,
          }));

        if (lineDiagnostics.length > 0) {
          result.diagnostics = lineDiagnostics;
        }
      }

      if (definitionResult.length > 0) {
        const definitionLocations = definitionResult
          .map((loc: any) => ({
            // Handle both Location (uri + range) and LocationLink (targetUri + targetRange) formats
            uri: loc.uri ?? loc.targetUri,
            range: loc.range ?? loc.targetRange,
          }))
          .filter((loc: any) => loc.uri)
          .map((loc: any) => ({
            path: String(loc.uri).replace(/^file:\/\//, ''),
            line: (loc.range?.start?.line ?? 0) + 1,
            character: (loc.range?.start?.character ?? 0) + 1,
          }))
          // Filter out definitions that point to the same location we're querying
          .filter((loc: any) => !(loc.path === absolutePath && loc.line === line));

        // Fetch previews for definition locations
        const previewPromises = definitionLocations.map((loc: any) => getLinePreview(loc.path, loc.line));
        const previews = await Promise.all(previewPromises);

        // Format: path:Lline:Cchar - with preview included
        result.definition = definitionLocations.map((loc: any, i: number) => ({
          location: `${compressPath(loc.path)}:L${loc.line}:C${loc.character}`,
          preview: previews[i],
        }));
      }

      if (implResult.length > 0) {
        const defPaths: string[] = Array.isArray(result.definition)
          ? result.definition.map((d: any) =>
              d.location?.split(':L')[1]
                ? `${d.location.split(':L')[0]}:L${d.location.split(':L')[1].split(':C')[0]}`
                : '',
            )
          : [];
        const implementationLocations = implResult
          .map((loc: any) => ({
            uri: loc.uri ?? loc.targetUri,
            range: loc.range ?? loc.targetRange,
          }))
          .filter((loc: any) => loc.uri)
          .map((loc: any) => ({
            path: String(loc.uri).replace(/^file:\/\//, ''),
            line: (loc.range?.start?.line ?? 0) + 1,
            character: (loc.range?.start?.character ?? 0) + 1,
          }))
          // Filter out implementations that match definition (same path+line) or same file/line as query
          .filter(
            (loc: any) =>
              !defPaths.includes(`${loc.path}:${loc.line}`) && !(loc.path === absolutePath && loc.line === line),
          );

        // Compress implementation to just path:line:character strings for efficiency
        result.implementation = implementationLocations.map(
          (loc: any) => `${compressPath(loc.path)}:L${loc.line}:C${loc.character}`,
        );
      }
    } catch (err) {
      result.error = `LSP query failed: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      // Clean up - close the file
      client.notifyClose(absolutePath);
    }

    return result;
  },
});
