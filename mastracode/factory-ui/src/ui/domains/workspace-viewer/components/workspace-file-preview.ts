import type { WorkspaceFile } from '../../../../api/types';
import { languageForPath } from '@mastra/playground-ui/components/CodeEditor';
import type { HighlightLanguage } from '@mastra/playground-ui/components/CodeEditor';

export interface WorkspaceFilePreview extends WorkspaceFile {
  language?: HighlightLanguage;
}

export function selectWorkspaceFilePreview(file: WorkspaceFile): WorkspaceFilePreview {
  const language = languageForPath(file.path);
  return { ...file, language };
}
