/**
 * LSP Inspect Tool
 *
 * Inspect code at a specific position using the Language Server Protocol.
 * The agent provides a file path, line number, and a `<<<` marker in the
 * line content to indicate the cursor position.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod/v4';

import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { requireWorkspace, emitWorkspaceMetadata } from './helpers';
import { startWorkspaceSpan } from './tracing';

const CURSOR_MARKER = '<<<';

/**
 * Get a single line preview from a file at the specified line number.
 * Returns the trimmed line content, or null if the line cannot be read.
 */
async function getLinePreview(filePath: string, lineNumber: number): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const line = lines[lineNumber - 1];
    return line?.trim() ?? null;
  } catch {
    return null;
  }
}

function getAbsolutePath(
  workspacePath: string,
  lspRoot: string,
  resolveAbsolutePath?: (path: string) => string | undefined,
) {
  const resolvedPath = resolveAbsolutePath?.(workspacePath);
  if (resolvedPath) {
    return resolvedPath;
  }

  if (path.isAbsolute(workspacePath)) {
    return workspacePath;
  }

  return path.resolve(lspRoot, workspacePath);
}

function locationUriToPath(uri: string): string | null {
  if (!uri.startsWith('file://')) {
    return null;
  }

  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}

function locationKey(location: { path: string; line: number }): string {
  return `${location.path}:L${location.line}`;
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

    const span = startWorkspaceSpan(context, workspace, {
      category: 'filesystem',
      operation: 'lspInspect',
      input: { path: filePath, line },
      attributes: {},
    });

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
      span.end({ success: false });
      return {
        error: `No <<< cursor marker found in match`,
      };
    }

    if (cursorPositions.length > 1) {
      span.end({ success: false });
      return {
        error: `Multiple <<< markers found (found ${cursorPositions.length}, expected 1)`,
      };
    }

    // 1-indexed character position (LSP uses 1-indexed)
    const character = cursorPositions[0]! + 1;

    // Get the LSP manager
    const lspManager = workspace.lsp;
    if (!lspManager) {
      span.end({ success: false });
      return {
        error: 'LSP is not configured for this workspace. Enable LSP in workspace config to use this tool.',
      };
    }

    const absolutePath = getAbsolutePath(
      filePath,
      lspManager.root,
      workspace.filesystem?.resolveAbsolutePath?.bind(workspace.filesystem),
    );

    let fileContent = '';
    try {
      fileContent = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      fileContent = '';
    }

    // Get client and prepare for querying
    let queryResult;
    try {
      queryResult = await lspManager.prepareQuery(absolutePath);
    } catch (err) {
      span.end({ success: false });
      return {
        error: `Failed to initialize LSP client: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (!queryResult) {
      span.end({ success: false });
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
      const hoverResult = await client.queryHover(uri, position).catch(() => null);
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

      const diagnosticsPromise = fileContent
        ? Promise.resolve()
            .then(() => {
              client.notifyChange(absolutePath, fileContent, 1);
              return client.waitForDiagnostics(absolutePath, 5000, true);
            })
            .catch(() => [])
        : Promise.resolve([]);

      // Secondary queries: diagnostics, definition, and implementation
      const [diagnosticsResult, definitionResult, implResult] = await Promise.all([
        diagnosticsPromise,
        client.queryDefinition(uri, position).catch(() => []),
        client.queryImplementation(uri, position).catch(() => []),
      ]);

      if (diagnosticsResult && diagnosticsResult.length > 0) {
        const lineDiagnostics = diagnosticsResult
          .map((diagnostic: any) => ({
            line: typeof diagnostic.line === 'number' ? diagnostic.line : (diagnostic.range?.start?.line ?? -1) + 1,
            severity:
              typeof diagnostic.severity === 'number'
                ? diagnostic.severity === 1
                  ? 'error'
                  : diagnostic.severity === 2
                    ? 'warning'
                    : diagnostic.severity === 3
                      ? 'info'
                      : 'hint'
                : diagnostic.severity,
            message: diagnostic.message,
            source: diagnostic.source ?? null,
          }))
          .filter(diagnostic => diagnostic.line === line)
          .map(({ severity, message, source }) => ({ severity, message, source }));

        if (lineDiagnostics.length > 0) {
          result.diagnostics = lineDiagnostics;
        }
      }

      const definitionLocations = definitionResult
        .map((loc: any) => ({
          uri: loc.uri ?? loc.targetUri,
          range: loc.range ?? loc.targetRange,
        }))
        .map((loc: any) => {
          const resolvedPath = loc.uri ? locationUriToPath(String(loc.uri)) : null;
          return resolvedPath
            ? {
                path: resolvedPath,
                line: (loc.range?.start?.line ?? 0) + 1,
                character: (loc.range?.start?.character ?? 0) + 1,
              }
            : null;
        })
        .filter((loc): loc is { path: string; line: number; character: number } => Boolean(loc))
        .filter(loc => !(loc.path === absolutePath && loc.line === line));

      if (definitionLocations.length > 0) {
        const previews = await Promise.all(definitionLocations.map(loc => getLinePreview(loc.path, loc.line)));
        result.definition = definitionLocations.map((loc, i) => ({
          location: `${compressPath(loc.path)}:L${loc.line}:C${loc.character}`,
          preview: previews[i],
        }));
      }

      const definitionKeys = new Set(definitionLocations.map(locationKey));
      const implementationLocations = implResult
        .map((loc: any) => ({
          uri: loc.uri ?? loc.targetUri,
          range: loc.range ?? loc.targetRange,
        }))
        .map((loc: any) => {
          const resolvedPath = loc.uri ? locationUriToPath(String(loc.uri)) : null;
          return resolvedPath
            ? {
                path: resolvedPath,
                line: (loc.range?.start?.line ?? 0) + 1,
                character: (loc.range?.start?.character ?? 0) + 1,
              }
            : null;
        })
        .filter((loc): loc is { path: string; line: number; character: number } => Boolean(loc))
        .filter(loc => !definitionKeys.has(locationKey(loc)) && !(loc.path === absolutePath && loc.line === line));

      if (implementationLocations.length > 0) {
        result.implementation = implementationLocations.map(
          loc => `${compressPath(loc.path)}:L${loc.line}:C${loc.character}`,
        );
      }
    } catch (err) {
      result.error = `LSP query failed: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      // Clean up - close the file
      client.notifyClose(absolutePath);
    }

    span.end({ success: !result.error });
    return result;
  },
});
