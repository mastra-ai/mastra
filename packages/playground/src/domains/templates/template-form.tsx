import { Button } from '@mastra/playground-ui/components/Button';
import { SelectFieldBlock, TextFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRightIcon, PackageOpenIcon } from 'lucide-react';
import { Fragment } from 'react';
import { AgentMetadataModelSwitcher } from '../agents/components/agent-metadata/agent-metadata-model-switcher';
import { Container } from './shared';

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
  isInstalling?: boolean;
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
  isInstalling,
  defaultModelProvider,
  defaultModelId,
  onModelUpdate,
}: TemplateFormProps) {
  return (
    <Container>
      <div className="mx-auto my-4 grid max-w-[40rem] gap-8 p-4 lg:p-8">
        <h2
          className={cn(
            'text-neutral4 text-header-sm font-semibold flex items-center gap-2',
            '[&>svg]:w-[1.2em] [&_svg]:h-[1.2em] [&_svg]:opacity-70',
          )}
        >
          Install Template <PackageOpenIcon />
        </h2>
        <SelectFieldBlock
          name="template-provider"
          options={providerOptions}
          label="Template AI Model Provider"
          onValueChange={onProviderChange}
          value={selectedProvider}
          placeholder="Select"
          layout="horizontal"
        />

        {selectedProvider && Object.entries(variables || {}).length > 0 && (
          <>
            <h3 className="text-neutral3 text-ui-md">Set required Environmental Variables</h3>
            <div className="grid grid-cols-[1fr_1fr] items-start gap-4">
              {isLoadingEnvVars ? (
                <div
                  className={cn(
                    'flex items-center justify-center col-span-2 text-neutral3 text-ui-sm gap-4',
                    '[&_svg]:opacity-50 [&_svg]:w-[1.1em] [&_svg]:h-[1.1em]',
                    'animate-in fade-in duration-300',
                  )}
                >
                  <Spinner /> Loading variables...
                </div>
              ) : (
                Object.entries(variables).map(([key, value]) => (
                  <Fragment key={key}>
                    <TextFieldBlock
                      name={`env-${key}`}
                      labelIsHidden={true}
                      label="Key"
                      value={key}
                      disabled
                      className="w-full"
                    />
                    <TextFieldBlock
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
            <div className="border-border1 relative mt-3.5 border-t pt-12">
              <div className="bg-surface2 text-ui-sm text-neutral3 absolute top-0 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-4 items-center justify-center rounded-full">
                And
              </div>

              <h3 className="text-neutral4 text-ui-lg">Set AI Model for Template Installation</h3>
              <p className="text-neutral3 text-ui-md mt-2 mb-8">
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
              'flex items-center gap-2 mt-4 justify-center text-ui-md w-full bg-surface5 min-h-10 rounded-lg text-neutral5 hover:bg-surface6 transition-colors',
              '[&>svg]:w-[1.1em] [&_svg]:h-[1.1em] [&_svg]:text-neutral5',
            )}
            onClick={handleInstallTemplate}
            disabled={
              !selectedProvider || !defaultModelProvider || !defaultModelId || errors.length > 0 || isInstalling
            }
          >
            {isInstalling ? (
              <>
                <Spinner className="h-4 w-4" /> Installing...
              </>
            ) : (
              <>
                Install <ArrowRightIcon />
              </>
            )}
          </Button>
        )}
      </div>
    </Container>
  );
}
