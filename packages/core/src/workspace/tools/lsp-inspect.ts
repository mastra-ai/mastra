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

export const lspInspectTool = createTool({
  id: WORKSPACE_TOOLS.LSP.LSP_INSPECT,
  description:
    'Inspect code at a specific position using the Language Server Protocol. ' +
    'Provide the file path, line number, and a line with <<< marking the cursor position. ' +
    'Returns hover information (types, documentation) and optionally definition and implementation locations. ' +
    'Use this to understand what a symbol is, its type, or where it is defined.',

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
    const result: Record<string, unknown> = {
      path: filePath,
    };

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

      // Secondary queries: definition and implementation
      const [definitionResult, implResult] = await Promise.all([
        client.queryDefinition(uri, position).catch(() => []),
        client.queryImplementation(uri, position).catch(() => []),
      ]);

      if (definitionResult.length > 0) {
        result.definition = definitionResult
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
      }

      if (implResult.length > 0) {
        const defPaths: string[] = Array.isArray(result.definition)
          ? result.definition.map((d: any) => `${d.path}:${d.line}`)
          : [];
        result.implementation = implResult
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
