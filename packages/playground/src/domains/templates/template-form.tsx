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
      <div className="mx-auto my-4 grid max-w-[40rem] gap-5 p-4 lg:p-5">
        <h2
          className={cn(
            'flex items-center gap-2 text-heading text-muted-foreground',
            '[&_svg]:h-[1.2em] [&_svg]:opacity-70 [&>svg]:w-[1.2em]',
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
            <h3 className="text-body text-muted-foreground">Set required Environmental Variables</h3>
            <div className="grid grid-cols-[1fr_1fr] items-start gap-4">
              {isLoadingEnvVars ? (
                <div
                  className={cn(
                    'col-span-2 flex items-center justify-center gap-4 text-caption text-muted-foreground',
                    '[&_svg]:h-[1.1em] [&_svg]:w-[1.1em] [&_svg]:opacity-50',
                    'animate-in duration-300 fade-in',
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
            <div className="relative mt-3.5 border-t border-border pt-12">
              <div className="absolute top-0 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-4 items-center justify-center rounded-full bg-background text-caption text-muted-foreground">
                And
              </div>

              <h3 className="text-body text-muted-foreground">Set AI Model for Template Installation</h3>
              <p className="mt-2 mb-5 text-body text-muted-foreground">
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
              'state-layer mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-card text-body text-foreground',
              '[&_svg]:h-[1.1em] [&_svg]:text-foreground [&>svg]:w-[1.1em]',
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
