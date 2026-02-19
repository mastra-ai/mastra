import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { v4 as uuid } from '@lukeed/uuid';

import { SideDialog } from '@/ds/components/SideDialog/side-dialog';
import { Input } from '@/ds/components/Input/input';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Txt } from '@/ds/components/Txt';
import { Combobox } from '@/ds/components/Combobox/combobox';
import { Workspace } from '@/ds/components/Workspace';
import { useWorkspaceContext } from '@/ds/components/Workspace/workspace-context';
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

interface SkillWorkspaceContentProps {
  files: InMemoryFileNode[];
  onChange: (files: InMemoryFileNode[]) => void;
  readOnly?: boolean;
  workspaceOptions: { value: string; label: string }[];
  workspaceId: string;
  setWorkspaceId: (workspaceId: string) => void;
}

function SkillWorkspaceContent({
  files,
  onChange,
  readOnly,
  workspaceOptions,
  workspaceId,
  setWorkspaceId,
}: SkillWorkspaceContentProps) {
  const { selectedPath, setSelectedPath } = useWorkspaceContext();

  const handleFileContentChange = useCallback(
    (content: string) => {
      if (!selectedPath) return;
      onChange(updateNodeContent(files, selectedPath, content));
    },
    [selectedPath, files, onChange],
  );

  const selectedFileContent = useMemo(() => {
    if (!selectedPath) return undefined;
    return findFileContent(files, selectedPath);
  }, [files, selectedPath]);

  const selectedFileName = useMemo(() => {
    if (!selectedPath) return undefined;
    return findFileName(files, selectedPath);
  }, [files, selectedPath]);

  const editorLanguage = useMemo(() => {
    if (!selectedFileName) return undefined;
    if (selectedFileName.endsWith('.md')) return 'markdown';
    if (selectedFileName.endsWith('.json')) return 'json';
    return undefined;
  }, [selectedFileName]);

  const isFileSelected = selectedPath !== null && selectedFileContent !== undefined;
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
          selectedFileId={selectedPath}
          onSelectFile={setSelectedPath}
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
                key={selectedPath}
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

export function SkillEditDialog({ isOpen, onClose, onSave, initialSkill, readOnly }: SkillEditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [files, setFiles] = useState<InMemoryFileNode[]>([]);
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

  return (
    <SideDialog
      dialogTitle={initialSkill ? 'Edit Skill' : 'Add Skill'}
      dialogDescription="Configure skill details and workspace files"
      isOpen={isOpen}
      onClose={onClose}
      className="h-full"
    >
      <SideDialog.Top>
        <span className="flex-1">{initialSkill ? 'Edit Skill' : 'New Skill'}</span>
        {!readOnly && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || !workspaceId}
            className="mr-6"
          >
            Save
          </Button>
        )}
      </SideDialog.Top>

      <SideDialog.Content className="overflow-y-auto h-full grid-rows-[auto_1fr]">
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
        </div>

        <Workspace className="h-full border border-border1 rounded-lg">
          <SkillWorkspaceContent
            files={files}
            onChange={setFiles}
            readOnly={readOnly}
            workspaceOptions={workspaceOptions}
            workspaceId={workspaceId}
            setWorkspaceId={setWorkspaceId}
          />
        </Workspace>
      </SideDialog.Content>
    </SideDialog>
  );
}
