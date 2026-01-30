'use client';

import { Controller } from 'react-hook-form';

import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { cn } from '@/lib/utils';

import { ModelPicker } from '../create-agent/model-picker';
import { useAgentCreateContext } from './agent-create-context';

export function AgentCreateMain() {
  const { form, formRef } = useAgentCreateContext();
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="flex flex-col gap-4 h-full px-4">
      {/* Agent Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name" className="text-xs text-icon5">
          Name <span className="text-accent2">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Enter agent name"
          {...register('name')}
          className={cn(errors.name && 'border-accent2')}
        />
        {errors.name && <span className="text-xs text-accent2">{errors.name.message}</span>}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description" className="text-xs text-icon5">
          Description
        </Label>
        <Input
          id="description"
          placeholder="Description (optional)"
          {...register('description')}
          className={cn(errors.description && 'border-accent2')}
        />
        {errors.description && <span className="text-xs text-accent2">{errors.description.message}</span>}
      </div>

      {/* Model */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-icon5">
          Model <span className="text-accent2">*</span>
        </Label>
        <Controller
          name="model"
          control={control}
          render={({ field }) => (
            <ModelPicker
              value={field.value}
              onChange={field.onChange}
              error={errors.model?.provider?.message || errors.model?.name?.message}
              container={formRef}
            />
          )}
        />
      </div>

      {/* Instructions - CodeEditor taking remaining height */}
      <div className="flex flex-col gap-1.5 flex-1 min-h-0">
        <Label htmlFor="instructions" className="text-xs text-icon5">
          Instructions <span className="text-accent2">*</span>
        </Label>
        <Controller
          name="instructions"
          control={control}
          render={({ field }) => (
            <CodeEditor
              value={field.value}
              onChange={field.onChange}
              language="markdown"
              showCopyButton={false}
              placeholder="Enter agent instructions..."
              className={cn('flex-1 min-h-[200px]', errors.instructions && 'border border-accent2')}
            />
          )}
        />
        {errors.instructions && <span className="text-xs text-accent2">{errors.instructions.message}</span>}
      </div>
    </div>
  );
}
