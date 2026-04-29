import type { StoredSkillResponse } from '@mastra/client-js';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SideDialog,
  Txt,
} from '@mastra/playground-ui';
import { AlertTriangle, Globe, LockIcon } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import { useCreateSkill } from '../../hooks/use-create-skill';
import type { InMemoryFileNode } from '../agent-edit-page/utils/form-validation';
import { createInitialStructure, updateRootFolderName } from './skill-file-tree';
import { SkillFolder } from './skill-folder';
import { useBuilderSettings } from '@/domains/builder/hooks/use-builder-settings';
import { useWorkspaceInfo } from '@/domains/workspace/hooks';
import { useStoredWorkspaces } from '@/domains/workspace/hooks/use-stored-workspaces';

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
  const { data: workspacesData } = useStoredWorkspaces();
  const { data: builderSettings } = useBuilderSettings();
  const workspaceOptions = useMemo(
    () => (workspacesData?.workspaces ?? []).map(ws => ({ value: ws.id, label: ws.name })),
    [workspacesData],
  );
  const { data: workspaceInfo } = useWorkspaceInfo(workspaceId || undefined);
  const hasFilesystem = workspaceInfo?.capabilities?.hasFilesystem ?? true;

  const builderDefaultWorkspaceId = useMemo(() => {
    const ws = (builderSettings?.configuration?.agent as Record<string, unknown> | undefined)?.workspace as
      | { type: string; workspaceId?: string }
      | undefined;
    return ws?.type === 'id' ? ws.workspaceId : undefined;
  }, [builderSettings]);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setVisibility('private');
      setWorkspaceId(builderDefaultWorkspaceId ?? (workspaceOptions.length === 1 ? workspaceOptions[0].value : ''));
      setFiles([]);
      prevNameRef.current = '';
    }
  }, [isOpen, workspaceOptions, builderDefaultWorkspaceId]);

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
            disabled={!name.trim() || !workspaceId || !hasFilesystem || createSkill.isPending}
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
              <Select value={visibility} onValueChange={next => setVisibility(next as 'private' | 'public')}>
                <SelectTrigger size="sm" aria-label="Visibility" className="w-fit">
                  <SelectValue placeholder="Visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <span className="flex items-center gap-2">
                      <LockIcon className="h-3.5 w-3.5" />
                      Private
                    </span>
                  </SelectItem>
                  <SelectItem value="public">
                    <span className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" />
                      Public
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {workspaceId && !hasFilesystem && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <Txt variant="ui-xs" className="text-amber-400">
              The selected workspace has no filesystem configured. Skill files cannot be saved. Add a filesystem to the
              workspace configuration.
            </Txt>
          </div>
        )}

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
