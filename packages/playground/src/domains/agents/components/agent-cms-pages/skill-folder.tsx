import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState, useCallback, useMemo } from 'react';

import type { InMemoryFileNode } from '../agent-edit-page/utils/form-validation';
import { SkillFileTree } from './skill-file-tree';
import { updateNodeContent, isImageContent } from './skill-file-tree-utils';

function findFileContent(nodes: InMemoryFileNode[], fileId: string): string | undefined {
  for (const node of nodes) {
    if (node.id === fileId && node.type === 'file') return node.content ?? '';
    if (node.children) {
      const found = findFileContent(node.children, fileId);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function findFileName(nodes: InMemoryFileNode[], fileId: string): string | undefined {
  for (const node of nodes) {
    if (node.id === fileId) return node.name;
    if (node.children) {
      const found = findFileName(node.children, fileId);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

interface SkillFolderProps {
  files: InMemoryFileNode[];
  onChange: (files: InMemoryFileNode[]) => void;
  readOnly?: boolean;
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
  workspaceOptions: { value: string; label: string }[];
}

export function SkillFolder({
  files,
  onChange,
  readOnly,
  workspaceId,
  setWorkspaceId,
  workspaceOptions,
}: SkillFolderProps) {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const handleFileContentChange = useCallback(
    (content: string) => {
      if (!selectedFileId) return;
      onChange(updateNodeContent(files, selectedFileId, content));
    },
    [selectedFileId, files, onChange],
  );

  const selectedFileContent = useMemo(() => {
    if (!selectedFileId) return undefined;
    return findFileContent(files, selectedFileId);
  }, [files, selectedFileId]);

  const selectedFileName = useMemo(() => {
    if (!selectedFileId) return undefined;
    return findFileName(files, selectedFileId);
  }, [files, selectedFileId]);

  const editorLanguage = useMemo(() => {
    if (!selectedFileName) return undefined;
    if (selectedFileName.endsWith('.md')) return 'markdown';
    if (selectedFileName.endsWith('.json')) return 'json';
    return undefined;
  }, [selectedFileName]);

  const isFileSelected = selectedFileId !== null && selectedFileContent !== undefined;
  const isImage = isImageContent(selectedFileContent);

  return (
    <div className="grid h-full grid-cols-[300px_1fr]">
      <div className="h-full overflow-y-auto border-r border-border p-4">
        {workspaceOptions.length > 0 && (
          <Field className="pb-4">
            <FieldLabel>Workspace</FieldLabel>
            <Combobox
              options={workspaceOptions}
              value={workspaceId}
              onValueChange={setWorkspaceId}
              placeholder="Select a workspace..."
              disabled={readOnly}
            />
          </Field>
        )}

        <SkillFileTree
          files={files}
          onChange={onChange}
          selectedFileId={selectedFileId}
          onSelectFile={setSelectedFileId}
          readOnly={readOnly}
        />
      </div>

      <div className="h-full p-4">
        {isFileSelected ? (
          <>
            {isImage ? (
              <div className="flex flex-1 items-center justify-center bg-background p-4">
                <img
                  src={selectedFileContent}
                  alt={selectedFileName}
                  className="max-h-dropdown max-w-full rounded-md object-contain"
                />
              </div>
            ) : (
              <CodeEditor
                key={selectedFileId}
                language={editorLanguage}
                value={selectedFileContent}
                onChange={readOnly ? undefined : (val: string | undefined) => handleFileContentChange(val ?? '')}
                showCopyButton={false}
                autoFocus
                className="h-full"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Txt as="span" variant="caption" className="block">
              Select a file to edit its content
            </Txt>
          </div>
        )}
      </div>
    </div>
  );
}
