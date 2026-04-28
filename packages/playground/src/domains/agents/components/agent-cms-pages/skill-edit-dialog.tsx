import type { StoredSkillResponse } from '@mastra/client-js';
import { Button, cn, Input, SideDialog, Txt } from '@mastra/playground-ui';
import { Globe, Lock } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import { useCreateSkill } from '../../hooks/use-create-skill';
import type { InMemoryFileNode } from '../agent-edit-page/utils/form-validation';
import { createInitialStructure, updateRootFolderName } from './skill-file-tree';
import { SkillFolder } from './skill-folder';
import { useWorkspaces } from '@/domains/workspace/hooks';

export interface SkillEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSkillCreated: (skill: StoredSkillResponse, workspaceId: string) => void;
  readOnly?: boolean;
}

export function SkillEditDialog({ isOpen, onClose, onSkillCreated, readOnly }: SkillEditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [workspaceId, setWorkspaceId] = useState('');
  const [files, setFiles] = useState<InMemoryFileNode[]>([]);
  const prevNameRef = useRef('');
  const createSkill = useCreateSkill();
  const { data: workspacesData } = useWorkspaces();
  const workspaceOptions = useMemo(
    () => (workspacesData?.workspaces ?? []).map(ws => ({ value: ws.id, label: ws.name })),
    [workspacesData],
  );

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setVisibility('private');
      setWorkspaceId(workspaceOptions.length === 1 ? workspaceOptions[0].value : '');
      setFiles([]);
      prevNameRef.current = '';
    }
  }, [isOpen, workspaceOptions]);

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

  const handleSave = useCallback(async () => {
    const result = await createSkill.mutateAsync({
      name,
      description,
      visibility,
      workspaceId,
      files,
    });
    onSkillCreated(result, workspaceId);
    onClose();
  }, [name, description, visibility, workspaceId, files, createSkill, onSkillCreated, onClose]);

  return (
    <SideDialog
      dialogTitle="Add Skill"
      dialogDescription="Configure skill details and workspace files"
      isOpen={isOpen}
      onClose={onClose}
      className="h-full"
    >
      <SideDialog.Top>
        <span className="flex-1">New Skill</span>
        {!readOnly && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || !workspaceId || createSkill.isPending}
            className="mr-6"
          >
            {createSkill.isPending ? 'Creating...' : 'Save'}
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

          {!readOnly && (
            <div className="flex flex-col gap-1.5">
              <Txt as="label" variant="ui-xs" className="text-neutral3">
                Visibility
              </Txt>
              <div className="inline-flex rounded-lg border border-border1 bg-surface1 p-0.5 w-fit">
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-ui-xs font-medium transition-colors',
                    visibility === 'private'
                      ? 'bg-surface3 text-neutral6 shadow-sm'
                      : 'text-neutral3 hover:text-neutral5',
                  )}
                >
                  <Lock className="h-3 w-3" />
                  Private
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-ui-xs font-medium transition-colors',
                    visibility === 'public'
                      ? 'bg-surface3 text-neutral6 shadow-sm'
                      : 'text-neutral3 hover:text-neutral5',
                  )}
                >
                  <Globe className="h-3 w-3" />
                  Public
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-full border border-border1 rounded-lg overflow-hidden">
          <SkillFolder
            files={files}
            onChange={setFiles}
            readOnly={readOnly}
            workspaceOptions={workspaceOptions}
            workspaceId={workspaceId}
            setWorkspaceId={setWorkspaceId}
          />
        </div>
      </SideDialog.Content>
    </SideDialog>
  );
}
