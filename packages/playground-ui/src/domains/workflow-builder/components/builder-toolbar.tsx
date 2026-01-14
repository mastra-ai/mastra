import { useCallback, useState, useRef, useEffect } from 'react';
import { ArrowLeft, Undo2, Redo2, Save, Loader2, AlertTriangle, Keyboard } from 'lucide-react';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';
import { useWorkflowDefinitionMutations } from '@/domains/workflow-definitions/hooks';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';
import { useLinkComponent } from '@/lib/framework';
import { serializeGraph } from '../utils/serialize';
import { ValidationBadge, ValidationPanel } from './validation-panel';
import { useWorkflowValidation } from '../hooks/use-workflow-validation';

export interface BuilderToolbarProps {
  className?: string;
  onShowShortcuts?: () => void;
}

export function BuilderToolbar({ className, onShowShortcuts }: BuilderToolbarProps) {
  const { navigate } = useLinkComponent();
  const { updateWorkflowDefinition } = useWorkflowDefinitionMutations();

  // Validation panel state
  const [showValidation, setShowValidation] = useState(false);
  const validationRef = useRef<HTMLDivElement>(null);
  const validation = useWorkflowValidation();

  // Close validation panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (validationRef.current && !validationRef.current.contains(event.target as Node)) {
        setShowValidation(false);
      }
    };

    if (showValidation) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showValidation]);

  // Store state
  const workflowId = useWorkflowBuilderStore(state => state.workflowId);
  const workflowName = useWorkflowBuilderStore(state => state.workflowName);
  const workflowDescription = useWorkflowBuilderStore(state => state.workflowDescription);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);
  const outputSchema = useWorkflowBuilderStore(state => state.outputSchema);
  const stateSchema = useWorkflowBuilderStore(state => state.stateSchema);
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const edges = useWorkflowBuilderStore(state => state.edges);
  const isDirty = useWorkflowBuilderStore(state => state.isDirty);
  const isSaving = useWorkflowBuilderStore(state => state.isSaving);

  // Store actions
  const setWorkflowMeta = useWorkflowBuilderStore(state => state.setWorkflowMeta);
  const setDirty = useWorkflowBuilderStore(state => state.setDirty);
  const setSaving = useWorkflowBuilderStore(state => state.setSaving);
  const undo = useWorkflowBuilderStore(state => state.undo);
  const redo = useWorkflowBuilderStore(state => state.redo);
  const canUndo = useWorkflowBuilderStore(state => state.canUndo);
  const canRedo = useWorkflowBuilderStore(state => state.canRedo);

  const handleBack = useCallback(() => {
    navigate('/workflows');
  }, [navigate]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setWorkflowMeta({ name: e.target.value });
    },
    [setWorkflowMeta],
  );

  const handleSave = useCallback(async () => {
    if (!workflowId || isSaving) return;

    setSaving(true);

    try {
      // Serialize the graph to workflow definition format
      const { stepGraph, steps } = serializeGraph(nodes, edges);

      await updateWorkflowDefinition.mutateAsync({
        id: workflowId,
        name: workflowName,
        description: workflowDescription || undefined,
        inputSchema,
        outputSchema,
        stateSchema: Object.keys(stateSchema).length > 0 ? stateSchema : undefined,
        stepGraph,
        steps,
      });

      setDirty(false);
    } catch (error) {
      console.error('Failed to save workflow:', error);
    } finally {
      setSaving(false);
    }
  }, [
    workflowId,
    workflowName,
    workflowDescription,
    inputSchema,
    outputSchema,
    nodes,
    edges,
    isSaving,
    setSaving,
    setDirty,
    updateWorkflowDefinition,
  ]);

  return (
    <div
      className={cn(
        'h-14 border-b border-border1 bg-surface2',
        'flex items-center justify-between px-4 gap-4',
        className,
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="md" onClick={handleBack} className="gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="h-6 w-px bg-border1" />

        <Input
          value={workflowName}
          onChange={handleNameChange}
          placeholder="Workflow name"
          className="w-64 h-8 text-sm"
        />

        {isDirty && (
          <div className="flex items-center gap-1 text-xs text-amber-500">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            Unsaved
          </div>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Validation badge with dropdown */}
        <div className="relative" ref={validationRef}>
          <ValidationBadge onClick={() => setShowValidation(!showValidation)} />

          {showValidation && (
            <div className="absolute top-full right-0 mt-2 z-50 w-[400px]">
              <ValidationPanel onClose={() => setShowValidation(false)} />
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-border1" />

        <Button variant="ghost" size="md" onClick={undo} disabled={!canUndo()} className="gap-1">
          <Undo2 className="w-4 h-4" />
        </Button>

        <Button variant="ghost" size="md" onClick={redo} disabled={!canRedo()} className="gap-1">
          <Redo2 className="w-4 h-4" />
        </Button>

        {/* Keyboard shortcuts button */}
        {onShowShortcuts && (
          <Button variant="ghost" size="md" onClick={onShowShortcuts} className="gap-1" aria-label="Keyboard shortcuts">
            <Keyboard className="w-4 h-4" />
          </Button>
        )}

        <div className="h-6 w-px bg-border1" />

        {/* Save button with validation-aware tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex">
                <Button
                  variant="default"
                  size="md"
                  onClick={handleSave}
                  disabled={isSaving || !isDirty || updateWorkflowDefinition.isPending || !validation.isValid}
                  className={cn('gap-2', !validation.isValid && isDirty && 'opacity-50')}
                >
                  {isSaving || updateWorkflowDefinition.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : !validation.isValid ? (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      Save
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </TooltipTrigger>
            {!validation.isValid && (
              <TooltipContent side="bottom" className="max-w-[300px]">
                <p className="font-medium text-red-400 mb-1">Cannot save: {validation.errors.length} error(s)</p>
                <ul className="text-xs space-y-0.5">
                  {validation.errors.slice(0, 3).map((err, i) => (
                    <li key={i} className="text-icon3">
                      {err.message}
                    </li>
                  ))}
                  {validation.errors.length > 3 && (
                    <li className="text-icon3">...and {validation.errors.length - 3} more</li>
                  )}
                </ul>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
