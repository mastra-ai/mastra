import type { WorkspaceFile } from '../../../../../../api/types';

export const typescriptFile: WorkspaceFile = {
  workspacePath: 'session-1',
  path: 'src/agent.ts',
  name: 'agent.ts',
  size: 28,
  updatedAt: '2026-08-07T00:00:00.000Z',
  contentType: 'text',
  content: 'export const agent = {};\n',
};

export const unknownLanguageFile: WorkspaceFile = {
  ...typescriptFile,
  path: 'notes.unknown',
  name: 'notes.unknown',
  content: '<script>alert("preview")</script> & plain text\n',
};

export const htmlFile: WorkspaceFile = {
  ...unknownLanguageFile,
  path: 'preview.html',
  name: 'preview.html',
};

export const markdownFile: WorkspaceFile = {
  ...typescriptFile,
  path: 'README.md',
  name: 'README.md',
  content: '# Workspace notes\n\nRead the preview.\n',
};

export const unsupportedFile: WorkspaceFile = {
  ...typescriptFile,
  path: 'image.png',
  name: 'image.png',
  contentType: 'unsupported',
  content: undefined,
};
