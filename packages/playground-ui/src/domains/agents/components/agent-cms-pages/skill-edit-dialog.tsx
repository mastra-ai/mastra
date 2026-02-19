import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { v4 as uuid } from '@lukeed/uuid';

import { SideDialog } from '@/ds/components/SideDialog/side-dialog';
import { Input } from '@/ds/components/Input/input';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Txt } from '@/ds/components/Txt';
import { Combobox } from '@/ds/components/Combobox/combobox';
import { useWorkspaces } from '@/domains/workspace/hooks';

import type { SkillFormValue, InMemoryFileNode } from '../agent-edit-page/utils/form-validation';
import {
  SkillFileTree,
  updateNodeContent,
  createInitialStructure,
  updateRootFolderName,
  isImageContent,
} from './skill-file-tree';

export interface SkillEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (skill: SkillFormValue) => void;
  initialSkill?: SkillFormValue;
  readOnly?: boolean;
}

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

export function SkillEditDialog({ isOpen, onClose, onSave, initialSkill, readOnly }: SkillEditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [files, setFiles] = useState<InMemoryFileNode[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [localId, setLocalId] = useState('');
  const prevNameRef = useRef('');

  const { data: workspacesData } = useWorkspaces();
  const workspaceOptions = useMemo(
    () => (workspacesData?.workspaces ?? []).map(ws => ({ value: ws.id, label: ws.name })),
    [workspacesData],
  );

  useEffect(() => {
    if (isOpen) {
      if (initialSkill) {
        setName(initialSkill.name);
        setDescription(initialSkill.description);
        setWorkspaceId(initialSkill.workspaceId);
        setFiles(initialSkill.files);
        setLocalId(initialSkill.localId);
        prevNameRef.current = initialSkill.name;
      } else {
        setName('');
        setDescription('');
        setWorkspaceId(workspaceOptions.length === 1 ? workspaceOptions[0].value : '');
        setFiles([]);
        setLocalId(uuid());
        prevNameRef.current = '';
      }
      setSelectedFileId(null);
    }
  }, [isOpen, initialSkill, workspaceOptions]);

  const handleNameChange = useCallback(
    (newName: string) => {
      setName(newName);

      const hasStructure = files.some(n => n.id === 'root');

      if (!hasStructure && newName.trim()) {
        setFiles(createInitialStructure(newName));
      } else if (hasStructure) {
        setFiles(prev => updateRootFolderName(prev, newName));
      }

      prevNameRef.current = newName;
    },
    [files],
  );

  const handleSave = useCallback(() => {
    onSave({
      localId,
      name,
      description,
      workspaceId,
      files,
    });
  }, [localId, name, description, workspaceId, files, onSave]);

  const handleFileContentChange = useCallback(
    (content: string) => {
      if (!selectedFileId) return;
      setFiles(prev => updateNodeContent(prev, selectedFileId, content));
    },
    [selectedFileId],
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
    <SideDialog
      dialogTitle={initialSkill ? 'Edit Skill' : 'Add Skill'}
      dialogDescription="Configure skill details and workspace files"
      isOpen={isOpen}
      onClose={onClose}
    >
      <SideDialog.Top>
        <span className="flex-1">{initialSkill ? 'Edit Skill' : 'New Skill'}</span>
        {!readOnly && (
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!name.trim() || !workspaceId} className="mr-6">
            Save
          </Button>
        )}
      </SideDialog.Top>

      <SideDialog.Content className="grid grid-cols-1 gap-6 overflow-y-auto">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Txt as="label" variant="ui-sm" className="text-neutral3">
              Name
            </Txt>
            <Input
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Skill name"
              disabled={readOnly}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Txt as="label" variant="ui-sm" className="text-neutral3">
              Description
            </Txt>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the skill"
              disabled={readOnly}
            />
          </div>

          <div className="flex flex-col gap-1.5">
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
        </div>

        <div className="flex flex-col gap-3">
          <Txt as="h3" variant="ui-lg" className="text-neutral5 font-medium">
            Workspace Files
          </Txt>

          <div className="grid grid-cols-[minmax(180px,_1fr)_2fr] gap-4 min-h-[200px]">
            <div className="border border-border1 rounded-md p-2 overflow-y-auto">
              <SkillFileTree
                files={files}
                onChange={setFiles}
                selectedFileId={selectedFileId}
                onSelectFile={setSelectedFileId}
                readOnly={readOnly}
              />
            </div>

            <div className="border border-border1 rounded-md overflow-hidden">
              {isFileSelected ? (
                <div className="flex flex-col h-full">
                  <div className="flex items-center px-3 py-1.5">
                    <Txt variant="ui-sm" className="text-neutral3 truncate">
                      {selectedFileName}
                    </Txt>
                  </div>
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
                      language={editorLanguage}
                      value={selectedFileContent}
                      onChange={readOnly ? undefined : val => handleFileContentChange(val ?? '')}
                      className="flex-1 min-h-[160px] border-none"
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-neutral3">
                  Select a file to edit its content
                </div>
              )}
            </div>
          </div>
        </div>
      </SideDialog.Content>
    </SideDialog>
  );
}
