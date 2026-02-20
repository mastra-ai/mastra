import { useState, useCallback, useMemo } from 'react';

import { Combobox } from '@/ds/components/Combobox/combobox';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Txt } from '@/ds/components/Txt';

import type { InMemoryFileNode } from '../agent-edit-page/utils/form-validation';
import { SkillFileTree, updateNodeContent, isImageContent } from './skill-file-tree';

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
    <div className="grid grid-cols-[300px_1fr] h-full">
      <div className="overflow-y-auto h-full border-r border-border1 p-4">
        <div className="flex flex-col gap-1.5 pb-4">
          <Txt as="label" variant="ui-sm" className="text-neutral3">
            Workspace
          </Txt>
          <Combobox
            options={workspaceOptions}
            value={workspaceId}
            onValueChange={setWorkspaceId}
            placeholder="Select a workspace..."
            disabled={readOnly}
            variant="default"
          />
        </div>

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
              <div className="flex items-center justify-center flex-1 p-4 bg-surface2">
                <img
                  src={selectedFileContent}
                  alt={selectedFileName}
                  className="max-w-full max-h-[300px] rounded-md object-contain"
                />
              </div>
            ) : (
              <CodeEditor
                key={selectedFileId}
                language={editorLanguage}
                value={selectedFileContent}
                onChange={readOnly ? undefined : val => handleFileContentChange(val ?? '')}
                showCopyButton={false}
                autoFocus
                className="h-full"
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-neutral3">
            Select a file to edit its content
          </div>
        )}
      </div>
    </div>
  );
}
