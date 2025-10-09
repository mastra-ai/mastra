import { InputField, AgentMetadataModelSwitcher } from '@mastra/playground-ui';
import type { AgentFormData, FormErrors } from './types';

interface BasicInfoSectionProps {
  formData: AgentFormData;
  errors: FormErrors;
  modelProviders: any[];
  onUpdateField: (field: keyof AgentFormData, value: any) => void;
  onUpdateModel: (params: { provider: string; modelId: string }) => Promise<{ message: string }>;
}

export function BasicInfoSection({
  formData,
  errors,
  modelProviders,
  onUpdateField,
  onUpdateModel,
}: BasicInfoSectionProps) {
  return (
    <div className="space-y-4 flex flex-col h-full">
      <div>
        <h3 className="text-base font-semibold text-mastra-el-1 mb-0.5">Basic Information</h3>
        <p className="text-xs text-mastra-el-3">Core agent settings</p>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto pr-1">
        <InputField
          name="id"
          label="Agent ID"
          value={formData.id}
          onChange={e => onUpdateField('id', e.target.value)}
          errorMsg={errors.id}
          required
        />

        <InputField
          name="name"
          label="Agent Name"
          value={formData.name}
          onChange={e => onUpdateField('name', e.target.value)}
          errorMsg={errors.name}
          required
        />

        <InputField
          name="description"
          label="Description"
          value={formData.description}
          onChange={e => onUpdateField('description', e.target.value)}
        />

        <div className="space-y-2">
          <label className="text-[0.8125rem] text-icon3 flex justify-between items-center">
            Model <i className="text-icon2">(required)</i>
          </label>
          <AgentMetadataModelSwitcher
            defaultProvider={formData.provider}
            defaultModel={formData.modelId}
            updateModel={onUpdateModel}
            modelProviders={modelProviders}
          />
          {errors.model && <p className="text-[0.75rem] text-red-400 flex items-center gap-[.5rem]">{errors.model}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="instructions" className="text-[0.8125rem] text-icon3 flex justify-between items-center">
            Instructions <i className="text-icon2">(required)</i>
          </label>
          <textarea
            id="instructions"
            value={formData.instructions}
            onChange={e => onUpdateField('instructions', e.target.value)}
            rows={4}
            placeholder="Enter agent instructions..."
            className="flex grow items-center cursor-pointer text-[0.875rem] text-[rgba(255,255,255,0.8)] border border-[rgba(255,255,255,0.15)] leading-normal rounded-lg bg-transparent px-[0.75rem] py-[0.5rem] w-full focus:outline-none focus:shadow-[inset_0_0_0_1px_#18fb6f] resize-none"
          />
          {errors.instructions && (
            <p className="text-[0.75rem] text-red-400 flex items-center gap-[.5rem]">{errors.instructions}</p>
          )}
        </div>
      </div>
    </div>
  );
}
