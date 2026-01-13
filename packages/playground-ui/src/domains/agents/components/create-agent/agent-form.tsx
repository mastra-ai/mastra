'use client';

import { Button } from '@/ds/components/Button/Button';
import type { StoredAgentResponse, CreateStoredAgentParams, UpdateStoredAgentParams } from '@mastra/client-js';

export interface AgentFormValues {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  model: Record<string, unknown>;
  tools?: string[];
  workflows?: string[];
  agents?: string[];
  memory?: string;
}

export interface AgentFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<AgentFormValues>;
  onSubmit: (values: CreateStoredAgentParams | UpdateStoredAgentParams) => Promise<void>;
  onCancel?: () => void;
  onDelete?: () => void;
  isSubmitting?: boolean;
}

export function AgentForm({ mode, initialValues, onSubmit, onCancel, onDelete, isSubmitting }: AgentFormProps) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const values: CreateStoredAgentParams | UpdateStoredAgentParams = {
      ...(mode === 'create' && { id: formData.get('id') as string }),
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || undefined,
      instructions: formData.get('instructions') as string,
      model: initialValues?.model || { provider: 'openai', name: 'gpt-4o' },
    };

    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === 'create' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="id" className="text-sm font-medium text-foreground">
            Agent ID
          </label>
          <input
            id="id"
            name="id"
            type="text"
            required
            defaultValue={initialValues?.id}
            placeholder="my-agent"
            className="flex h-9 w-full rounded-md border border-border1 bg-surface1 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={initialValues?.name}
          placeholder="My Agent"
          className="flex h-9 w-full rounded-md border border-border1 bg-surface1 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-foreground">
          Description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          defaultValue={initialValues?.description}
          placeholder="A helpful assistant..."
          className="flex h-9 w-full rounded-md border border-border1 bg-surface1 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="instructions" className="text-sm font-medium text-foreground">
          Instructions
        </label>
        <textarea
          id="instructions"
          name="instructions"
          required
          defaultValue={initialValues?.instructions}
          placeholder="You are a helpful assistant..."
          rows={4}
          className="flex w-full rounded-md border border-border1 bg-surface1 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
      </div>

      <div className="flex justify-between pt-4">
        <div>
          {mode === 'edit' && onDelete && (
            <Button type="button" variant="outline" onClick={onDelete} className="text-red-500 hover:text-red-600">
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Agent' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
