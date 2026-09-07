import type { WorkspaceFile } from '../../../../api/types';
import { highlightCode, languageForPath } from '../../../ui/highlight';

export interface WorkspaceFilePreview extends WorkspaceFile {
  language?: string;
  highlightedContent?: string;
}

export function selectWorkspaceFilePreview(file: WorkspaceFile): WorkspaceFilePreview {
  const language = languageForPath(file.path);
  const highlightedContent =
    file.contentType === 'text' && language !== 'markdown' ? highlightCode(file.content ?? '', language) : undefined;

  return { ...file, language, highlightedContent };
}
