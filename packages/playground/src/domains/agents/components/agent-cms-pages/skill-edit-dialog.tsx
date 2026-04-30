import type { StoredSkillResponse } from '@mastra/client-js';
import { Button, SideDialog } from '@mastra/playground-ui';
import { AlertTriangle, ChevronRight, Pencil, Settings2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import { useCreateSkill } from '../../hooks/use-create-skill';
import { useUpdateSkill } from '../../hooks/use-update-skill';
import type { InMemoryFileNode } from '../agent-edit-page/utils/form-validation';
import { SkillChatComposer } from './skill-chat-composer';
import { createInitialStructure, updateNodeContent, updateRootFolderName } from './skill-file-tree';
import { SkillFolder } from './skill-folder';
import { SkillSimpleForm } from './skill-simple-form';
import { useBuilderSettings } from '@/domains/builder/hooks/use-builder-settings';
import { VisibilityBadge } from '@/domains/shared/components/visibility-badge';
import { useWorkspaceInfo } from '@/domains/workspace/hooks';
import { useStoredWorkspaces } from '@/domains/workspace/hooks/use-stored-workspaces';

type DialogMode = 'simple' | 'advanced';

export interface SkillEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSkillCreated?: (skill: StoredSkillResponse, workspaceId: string) => void;
  onSkillUpdated?: (skill: StoredSkillResponse) => void;
  /** When provided, opens in view/edit mode for an existing skill */
  skill?: StoredSkillResponse;
  /** Current user ID for ownership checks */
  currentUserId?: string;
  /** Whether the current user is an admin (enables advanced file-tree mode) */
  isAdmin?: boolean;
}

export function SkillEditDialog({
  isOpen,
  onClose,
  onSkillCreated,
  onSkillUpdated,
  skill,
  currentUserId,
  isAdmin,
}: SkillEditDialogProps) {
  const [mode, setMode] = useState<DialogMode>('simple');
  const [isEditing, setIsEditing] = useState(false);
  const [chatSessionKey, setChatSessionKey] = useState(() => nanoid());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [instructions, setInstructions] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [files, setFiles] = useState<InMemoryFileNode[]>([]);
  const prevNameRef = useRef('');
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
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

  const isExistingSkill = !!skill;
  const isOwner = !skill || (!!currentUserId && skill.authorId === currentUserId);
  const isViewMode = isExistingSkill && !isEditing;
  const isReadOnly = isViewMode || !isOwner;

  // Reset state when dialog opens/closes or skill changes
  useEffect(() => {
    if (isOpen) {
      if (skill) {
        // View/edit mode for existing skill
        setName(skill.name ?? '');
        setDescription(skill.description ?? '');
        setVisibility(skill.visibility ?? 'private');
        setInstructions(skill.instructions ?? '');
        setIsEditing(false);
        setMode('simple');
        if (skill.files?.length) {
          setFiles(skill.files as InMemoryFileNode[]);
        } else {
          const initial = createInitialStructure(skill.name ?? 'untitled');
          setFiles(skill.instructions ? updateNodeContent(initial, 'skill-md', skill.instructions) : initial);
        }
        setWorkspaceId(builderDefaultWorkspaceId ?? (workspaceOptions.length === 1 ? workspaceOptions[0].value : ''));
      } else {
        // Create mode
        setName('');
        setDescription('');
        setVisibility('private');
        setInstructions('');
        setWorkspaceId(builderDefaultWorkspaceId ?? (workspaceOptions.length === 1 ? workspaceOptions[0].value : ''));
        setFiles([]);
        setIsEditing(false);
        setMode('simple');
      }
      prevNameRef.current = '';
      setChatSessionKey(nanoid());
    }
  }, [isOpen, skill, workspaceOptions, builderDefaultWorkspaceId]);

  const handleNameChange = useCallback(
    (newName: string) => {
      setName(newName);

      const hasStructure = files.some(n => n.id === 'root');

      if (!hasStructure && newName.trim()) {
        const initial = createInitialStructure(newName);
        setFiles(instructions ? updateNodeContent(initial, 'skill-md', instructions) : initial);
      } else if (hasStructure) {
        setFiles(prev => updateRootFolderName(prev, newName));
      }

      prevNameRef.current = newName;
    },
    [files, instructions],
  );

  const handleInstructionsChange = useCallback(
    (newInstructions: string) => {
      setInstructions(newInstructions);
      const hasStructure = files.some(n => n.id === 'root');
      if (hasStructure) {
        setFiles(prev => updateNodeContent(prev, 'skill-md', newInstructions));
      }
    },
    [files],
  );

  const handleSave = useCallback(async () => {
    let filesToSave = files;
    if (!filesToSave.some(n => n.id === 'root') && name.trim()) {
      const initial = createInitialStructure(name);
      filesToSave = instructions ? updateNodeContent(initial, 'skill-md', instructions) : initial;
    }

    if (isExistingSkill && skill) {
      const result = await updateSkill.mutateAsync({
        id: skill.id,
        name,
        description,
        visibility,
        instructions,
        files: filesToSave,
        workspaceId,
      });
      onSkillUpdated?.(result);
      onClose();
    } else {
      const result = await createSkill.mutateAsync({
        name,
        description,
        visibility,
        workspaceId,
        files: filesToSave,
      });
      onSkillCreated?.(result, workspaceId);
      onClose();
    }
  }, [
    name,
    description,
    visibility,
    instructions,
    workspaceId,
    files,
    isExistingSkill,
    skill,
    createSkill,
    updateSkill,
    onSkillCreated,
    onSkillUpdated,
    onClose,
  ]);

  const isPending = createSkill.isPending || updateSkill.isPending;

  const dialogTitle = isExistingSkill ? (isEditing ? 'Edit Skill' : 'Skill Details') : 'Add Skill';

  return (
    <SideDialog
      dialogTitle={dialogTitle}
      dialogDescription={isExistingSkill ? 'View or edit skill details' : 'Configure skill details'}
      isOpen={isOpen}
      onClose={onClose}
      className="h-full"
    >
      <SideDialog.Top>
        <span className="flex-1 flex items-center gap-2">
          {dialogTitle}
          {isViewMode && skill && <VisibilityBadge visibility={skill.visibility} authorId={skill.authorId} size="sm" />}
        </span>
        <div className="flex items-center gap-2 mr-6">
          {isViewMode && isOwner && (
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {!isReadOnly && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!name.trim() || (!isExistingSkill && (!workspaceId || !hasFilesystem)) || isPending}
            >
              {isPending ? 'Saving...' : isExistingSkill ? 'Save' : 'Create'}
            </Button>
          )}
        </div>
      </SideDialog.Top>

      <SideDialog.Content className="h-full grid-rows-[1fr_auto] overflow-hidden">
        {mode === 'simple' ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <SkillSimpleForm
                name={name}
                onNameChange={handleNameChange}
                description={description}
                onDescriptionChange={setDescription}
                visibility={visibility}
                onVisibilityChange={setVisibility}
                instructions={instructions}
                onInstructionsChange={handleInstructionsChange}
                readOnly={isReadOnly}
              />

              {!isReadOnly && !hasFilesystem && workspaceId && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-yellow-500/10 p-3 text-xs text-yellow-600">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>The selected workspace has no filesystem configured. Skill files cannot be written.</span>
                </div>
              )}

              {!isReadOnly && isAdmin && (
                <button
                  onClick={() => setMode('advanced')}
                  className="mt-4 flex items-center gap-1.5 text-xs text-neutral3 hover:text-neutral5 transition-colors"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Advanced mode
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>

            {!isReadOnly && (
              <div className="shrink-0 pt-4 border-t border-border1">
                <SkillChatComposer
                  sessionKey={chatSessionKey}
                  onNameChange={handleNameChange}
                  onDescriptionChange={setDescription}
                  onInstructionsChange={handleInstructionsChange}
                  onVisibilityChange={setVisibility}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0 overflow-y-auto">
              {!isReadOnly && isAdmin && (
                <button
                  onClick={() => setMode('simple')}
                  className="mb-4 flex items-center gap-1.5 text-xs text-neutral3 hover:text-neutral5 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Simple mode
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}

              <SkillFolder
                files={files}
                onChange={setFiles}
                readOnly={isReadOnly}
                workspaceId={workspaceId}
                setWorkspaceId={setWorkspaceId}
                workspaceOptions={workspaceOptions}
              />
            </div>

            {!isReadOnly && (
              <div className="shrink-0 pt-4 border-t border-border1">
                <SkillChatComposer
                  sessionKey={chatSessionKey}
                  onNameChange={handleNameChange}
                  onDescriptionChange={setDescription}
                  onInstructionsChange={handleInstructionsChange}
                  onVisibilityChange={setVisibility}
                />
              </div>
            )}
          </div>
        )}
      </SideDialog.Content>
    </SideDialog>
  );
}
