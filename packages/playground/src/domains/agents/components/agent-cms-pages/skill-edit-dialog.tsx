import type { StoredSkillResponse } from '@mastra/client-js';
import {
  Button,
  Icon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SideDialog,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@mastra/playground-ui';
import { AlertTriangle, ChevronDown, ChevronRight, Globe, LockIcon, Pencil, Settings2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import { useCreateSkill } from '../../hooks/use-create-skill';
import { useUpdateSkill } from '../../hooks/use-update-skill';
import type { InMemoryFileNode } from '../agent-edit-page/utils/form-validation';
import { SkillChatComposer } from './skill-chat-composer';
import {
  createInitialStructure,
  extractSkillInstructions,
  updateNodeContent,
  updateRootFolderName,
} from './skill-file-tree';
import { SkillFolder } from './skill-folder';
import { SkillSimpleForm } from './skill-simple-form';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { useDefaultVisibility } from '@/domains/auth/hooks/use-default-visibility';
import { useBuilderSettings } from '@/domains/builder/hooks/use-builder-settings';
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
  // In create mode, form is hidden until agent populates fields or user expands it
  const [showForm, setShowForm] = useState(false);
  const prevNameRef = useRef('');
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const { data: workspacesData } = useStoredWorkspaces();
  const { data: builderSettings } = useBuilderSettings();
  const { data: authCapabilities } = useAuthCapabilities();
  const authEnabled = !!authCapabilities?.enabled;
  const defaultVisibility = useDefaultVisibility();
  const workspaceOptions = useMemo(
    () =>
      (workspacesData?.workspaces ?? [])
        .filter(ws => ws.status !== 'archived')
        .sort((a, b) => (b.runtimeRegistered ? 1 : 0) - (a.runtimeRegistered ? 1 : 0))
        .map(ws => ({ value: ws.id, label: ws.name })),
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
  const isOwner = !skill || !currentUserId || skill.authorId === currentUserId;
  const isViewMode = isExistingSkill && !isEditing;
  const isReadOnly = isViewMode || !isOwner;
  const hasFields = !!(name.trim() || description.trim() || instructions.trim());

  // Reset state when dialog opens/closes or skill changes
  useEffect(() => {
    if (isOpen) {
      if (skill) {
        // View/edit mode for existing skill
        setName(skill.name ?? '');
        setDescription(skill.description ?? '');
        setVisibility(skill.visibility ?? defaultVisibility);
        setInstructions(skill.instructions ?? '');
        setIsEditing(false);
        setMode('simple');
        setShowForm(true); // Always show form for existing skills
        if (skill.files?.length) {
          setFiles(skill.files as InMemoryFileNode[]);
        } else {
          const initial = createInitialStructure(skill.name ?? 'untitled');
          setFiles(skill.instructions ? updateNodeContent(initial, 'skill-md', skill.instructions) : initial);
        }
        setWorkspaceId(builderDefaultWorkspaceId ?? (workspaceOptions.length === 1 ? workspaceOptions[0].value : ''));
      } else {
        // Create mode — start chat-first
        setName('');
        setDescription('');
        setVisibility(defaultVisibility);
        setInstructions('');
        setWorkspaceId(builderDefaultWorkspaceId ?? (workspaceOptions.length === 1 ? workspaceOptions[0].value : ''));
        setFiles([]);
        setIsEditing(false);
        setMode('simple');
        setShowForm(false); // Hide form until agent fills or user expands
      }
      prevNameRef.current = '';
      setChatSessionKey(nanoid());
    }
  }, [isOpen, skill, workspaceOptions, builderDefaultWorkspaceId, defaultVisibility]);

  const handleNameChange = useCallback((newName: string) => {
    setName(newName);
    setInstructions(currentInstructions => {
      // Read latest instructions via functional updater (no-op on the value)
      setFiles(prev => {
        const hasStructure = prev.some(n => n.id === 'root');
        if (!hasStructure && newName.trim()) {
          const initial = createInitialStructure(newName);
          return currentInstructions ? updateNodeContent(initial, 'skill-md', currentInstructions) : initial;
        } else if (hasStructure) {
          return updateRootFolderName(prev, newName);
        }
        return prev;
      });
      return currentInstructions; // don't change instructions
    });
    prevNameRef.current = newName;
  }, []);

  const handleInstructionsChange = useCallback((newInstructions: string) => {
    setInstructions(newInstructions);
    setFiles(prev => {
      const hasStructure = prev.some(n => n.id === 'root');
      if (hasStructure) {
        return updateNodeContent(prev, 'skill-md', newInstructions);
      }
      return prev;
    });
  }, []);

  // Keep instructions state in sync when the file tree changes (e.g. admin
  // edits SKILL.md directly in the code editor in advanced mode).
  const handleFilesChange = useCallback((newFiles: InMemoryFileNode[]) => {
    setFiles(newFiles);
    const skillMdContent = extractSkillInstructions(newFiles);
    setInstructions(skillMdContent);
  }, []);

  const handleFieldsPopulated = useCallback(() => {
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    let filesToSave = files;
    if (!filesToSave.some(n => n.id === 'root') && name.trim()) {
      // No file structure yet — create it
      filesToSave = createInitialStructure(name);
    }
    // Always sync instructions state into SKILL.md before saving.
    // This is the authoritative source — handleFilesChange keeps it in sync
    // with any direct SKILL.md edits made in advanced mode.
    if (instructions && filesToSave.some(n => n.id === 'root')) {
      filesToSave = updateNodeContent(filesToSave, 'skill-md', instructions);
    }

    if (isExistingSkill && skill) {
      const result = await updateSkill.mutateAsync({
        id: skill.id,
        name,
        description,
        visibility,
        instructions,
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
      dialogDescription={isExistingSkill ? 'View or edit skill details' : 'Describe what your skill should do'}
      isOpen={isOpen}
      onClose={onClose}
      className="h-full"
    >
      <SideDialog.Top>
        <span className="flex-1 flex items-center gap-2">
          {dialogTitle}
          {isViewMode && skill?.visibility === 'private' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-neutral3 shrink-0" aria-label="Private skill">
                  <Icon size="sm">
                    <LockIcon />
                  </Icon>
                </span>
              </TooltipTrigger>
              <TooltipContent>Only visible to you</TooltipContent>
            </Tooltip>
          )}
        </span>
        <div className="flex items-center gap-2 mr-6">
          {isViewMode && isOwner && (
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {!isReadOnly && (
            <>
              {authEnabled && (
                <Select value={visibility} onValueChange={next => setVisibility(next as 'private' | 'public')}>
                  <SelectTrigger size="sm" aria-label="Visibility" className="w-fit gap-1.5">
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
              )}
              <Button variant="primary" size="sm" onClick={handleSave} disabled={!name.trim() || isPending}>
                {isPending ? 'Saving...' : isExistingSkill ? 'Save' : 'Create'}
              </Button>
            </>
          )}
        </div>
      </SideDialog.Top>

      <SideDialog.Content className="h-full overflow-y-auto">
        {isReadOnly ? (
          /* View mode — just show the form */
          <SkillSimpleForm
            name={name}
            onNameChange={handleNameChange}
            description={description}
            onDescriptionChange={setDescription}
            instructions={instructions}
            onInstructionsChange={handleInstructionsChange}
            readOnly
          />
        ) : (
          /* Create/Edit mode — single scrollable column: chat on top, form below */
          <div className="flex flex-col gap-4">
            {/* Chat section — always on top */}
            <SkillChatComposer
              sessionKey={chatSessionKey}
              hasFields={hasFields}
              onFieldsPopulated={handleFieldsPopulated}
              formState={{ name, description, instructions }}
              onNameChange={handleNameChange}
              onDescriptionChange={setDescription}
              onInstructionsChange={handleInstructionsChange}
            />

            {/* Form section — revealed after agent populates or user expands */}
            {showForm ? (
              <div className="border-t border-border1 pt-4">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex items-center gap-1.5 text-xs text-neutral3 hover:text-neutral5 transition-colors mb-3"
                >
                  <ChevronDown className="h-3 w-3" />
                  Hide skill details
                </button>

                {isAdmin && (!hasFilesystem || !workspaceId) && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg bg-yellow-500/10 p-3 text-xs text-yellow-600">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {!workspaceId
                        ? 'No workspace available. The skill will be saved to the database only.'
                        : 'No workspace filesystem configured. The skill will be saved to the database only.'}
                    </span>
                  </div>
                )}

                {mode === 'simple' ? (
                  <>
                    <SkillSimpleForm
                      name={name}
                      onNameChange={handleNameChange}
                      description={description}
                      onDescriptionChange={setDescription}
                      instructions={instructions}
                      onInstructionsChange={handleInstructionsChange}
                    />

                    {isAdmin && (
                      <button
                        onClick={() => {
                          // Ensure file tree has latest instructions before switching
                          const hasStructure = files.some(n => n.id === 'root');
                          if (!hasStructure && name.trim()) {
                            setFiles(
                              instructions
                                ? updateNodeContent(createInitialStructure(name), 'skill-md', instructions)
                                : createInitialStructure(name),
                            );
                          } else if (hasStructure && instructions) {
                            setFiles(prev => updateNodeContent(prev, 'skill-md', instructions));
                          }
                          setMode('advanced');
                        }}
                        className="mt-3 flex items-center gap-1.5 text-xs text-neutral3 hover:text-neutral5 transition-colors"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Advanced mode
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          // Pull SKILL.md edits back into the simple form
                          const extracted = extractSkillInstructions(files);
                          if (extracted) {
                            setInstructions(extracted);
                          }
                          setMode('simple');
                        }}
                        className="mb-3 flex items-center gap-1.5 text-xs text-neutral3 hover:text-neutral5 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Simple mode
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                    <SkillFolder
                      files={files}
                      onChange={handleFilesChange}
                      readOnly={false}
                      workspaceId={workspaceId}
                      setWorkspaceId={setWorkspaceId}
                      workspaceOptions={workspaceOptions}
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="border-t border-border1 pt-3">
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 text-xs text-neutral3 hover:text-neutral5 transition-colors"
                >
                  <ChevronRight className="h-3 w-3" />
                  {hasFields ? 'Show skill details' : 'or fill in manually'}
                </button>
              </div>
            )}
          </div>
        )}
      </SideDialog.Content>
    </SideDialog>
  );
}
