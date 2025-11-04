import { InputField, SelectField } from '@/components/ui/elements';
import { cn } from '@/lib/utils';
import { ArrowRightIcon, PackageOpenIcon } from 'lucide-react';
import { Fragment } from 'react';
import { Container } from './shared';
import Spinner from '@/components/ui/spinner';
import { AgentMetadataModelSwitcher } from '../agents/components/agent-metadata/agent-metadata-model-switcher';
import { Button } from '@/components/ui/elements/buttons';

type TemplateFormProps = {
  providerOptions: { value: string; label: string }[];
  selectedProvider: string;
  onProviderChange: (value: string) => void;
  variables: Record<string, string>;
  setVariables: (variables: Record<string, string>) => void;
  errors: string[];
  setErrors: (errors: string[]) => void;
  handleInstallTemplate: () => void;
  handleVariableChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoadingEnvVars?: boolean;
  defaultModelProvider?: string;
  defaultModelId?: string;
  onModelUpdate?: (params: { provider: string; modelId: string }) => Promise<{ message: string }>;
};

export function TemplateForm({
  providerOptions,
  selectedProvider,
  onProviderChange,
  variables,
  errors,
  handleInstallTemplate,
  handleVariableChange,
  isLoadingEnvVars,
  defaultModelProvider,
  defaultModelId,
  onModelUpdate,
}: TemplateFormProps) {
  return (
    <Container>
      <div className="max-w-[40rem] my-[1rem] p-[1rem] lg:p-[2rem] mx-auto gap-[2rem] grid">
        <h2
          className={cn(
            'text-icon4 text-[1.125rem] font-semibold flex items-center gap-[0.5rem]',
            '[&>svg]:w-[1.2em] [&_svg]:h-[1.2em] [&_svg]:opacity-70 ',
          )}
        >
          Install Template <PackageOpenIcon />
        </h2>
        <SelectField
          options={providerOptions}
          label="Template AI Model Provider"
          onValueChange={onProviderChange}
          value={selectedProvider}
          placeholder="Select"
        />

        {selectedProvider && Object.entries(variables || {}).length > 0 && (
          <>
            <h3 className="text-icon3 text-[0.875rem]">Set required Environmental Variables</h3>
            <div className="grid grid-cols-[1fr_1fr] gap-[1rem] items-start">
              {isLoadingEnvVars ? (
                <div
                  className={cn(
                    'flex items-center justify-center col-span-2 text-icon3 text-[0.75rem] gap-[1rem]',
                    '[&_svg]:opacity-50 [&_svg]:w-[1.1em] [&_svg]:h-[1.1em]',
                    'animate-in fade-in duration-300',
                  )}
                >
                  <Spinner /> Loading variables...
                </div>
              ) : (
                Object.entries(variables).map(([key, value]) => (
                  <Fragment key={key}>
                    <InputField
                      name={`env-${key}`}
                      labelIsHidden={true}
                      label="Key"
                      value={key}
                      disabled
                      className="w-full"
                    />
                    <InputField
                      name={key}
                      labelIsHidden={true}
                      label="Value"
                      value={value}
                      onChange={handleVariableChange}
                      errorMsg={errors.includes(key) ? `Value is required.` : ''}
                      autoComplete="off"
                      className="w-full"
                    />
                  </Fragment>
                ))
              )}
            </div>
            <div className="border-t border-border1 pt-[3rem] mt-[0.875rem] relative">
              <div className="absolute w-[2rem] h-[2rem] rounded-full bg-surface2 top-0 left-[50%] translate-x-[-50%] translate-y-[-1rem] text-[0.75rem] text-icon3 flex items-center justify-center">
                And
              </div>

              <h3 className="text-icon4 text-[1rem]">Set AI Model for Template Installation</h3>
              <p className="text-icon3 text-[0.875rem] mt-[.5rem] mb-[2rem]">
                This model will be used by the workflow to process and install the template
              </p>

              <AgentMetadataModelSwitcher
                defaultProvider={defaultModelProvider || ''}
                defaultModel={defaultModelId || ''}
                updateModel={onModelUpdate || (() => Promise.resolve({ message: 'Updated' }))}
                closeEditor={() => {}} // No need to close in template context
                autoSave={true}
                selectProviderPlaceholder="Provider"
              />
            </div>
          </>
        )}

        {selectedProvider && !isLoadingEnvVars && (
          <Button
            className={cn(
              'flex items-center gap-[0.5rem] mt-[1rem] justify-center text-[0.875rem] w-full bg-surface5 min-h-[2.5rem] rounded-lg text-icon5 hover:bg-surface6 transition-colors',
              '[&>svg]:w-[1.1em] [&_svg]:h-[1.1em] [&_svg]:text-icon5',
            )}
            onClick={handleInstallTemplate}
            disabled={!selectedProvider || !defaultModelProvider || !defaultModelId || errors.length > 0}
          >
            Install <ArrowRightIcon />
          </Button>
        )}
      </div>
    </Container>
  );
}
