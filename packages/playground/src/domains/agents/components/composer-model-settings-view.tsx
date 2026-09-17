import { Button } from '@mastra/playground-ui/components/Button';
import { ComposerModelSettingsButton } from '@mastra/playground-ui/components/Composer';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Entry } from '@mastra/playground-ui/components/Entry';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Slider } from '@mastra/playground-ui/components/Slider';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Info, Settings2, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { ModelSettings as ModelSettingsValues } from '../../../types';
import { AgentAdvancedSettingsBody } from './agent-advanced-settings';

export interface ComposerModelSettingsViewProps {
  value: ModelSettingsValues;
  onChange: (value: ModelSettingsValues) => void;
  children?: ReactNode;
  onReset: () => void;
  canEdit?: boolean;
  loading?: boolean;
  samplingNotice?: string;
}

export function ComposerModelSettingsView({
  value,
  onChange,
  children,
  onReset,
  canEdit = true,
  loading,
  samplingNotice,
}: ComposerModelSettingsViewProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  return (
    <>
      <Popover
        open={popoverOpen}
        onOpenChange={(open, details) => {
          if (!open && advancedOpen) {
            details?.cancel?.();
            return;
          }
          setPopoverOpen(open);
        }}
      >
        <PopoverTrigger render={<ComposerModelSettingsButton />} />
        <PopoverContent align="start" className="w-80 p-4">
          {loading ? (
            <Skeleton className="h-40 w-full" data-testid="composer-model-settings-skeleton" />
          ) : (
            <section className="@container space-y-5">
              {children}
              {samplingNotice && (
                <div
                  className="bg-surface3 text-ui-sm text-neutral3 flex items-center gap-2 rounded px-3 py-2"
                  data-testid="sampling-restriction-banner"
                >
                  <Info className="size-3.5 shrink-0" />
                  <span>{samplingNotice}</span>
                </div>
              )}
              <Entry label="Temperature">
                <div className="flex flex-row items-center justify-between gap-2">
                  <Slider
                    aria-label="Temperature"
                    value={[value.temperature ?? -0.1]}
                    max={1}
                    min={-0.1}
                    step={0.1}
                    disabled={!canEdit}
                    onValueChange={values => {
                      const temperature = values[0];
                      if (canEdit && temperature !== undefined)
                        onChange({ ...value, temperature: temperature < 0 ? undefined : temperature });
                    }}
                  />
                  <Txt as="p" variant="ui-sm" className="text-neutral3">
                    {value.temperature ?? 'n/a'}
                  </Txt>
                </div>
              </Entry>
              <Entry label="Top P">
                <div className="flex flex-row items-center justify-between gap-2">
                  <Slider
                    aria-label="Top P"
                    value={[value.topP ?? -0.1]}
                    max={1}
                    min={-0.1}
                    step={0.1}
                    disabled={!canEdit}
                    onValueChange={values => {
                      const topP = values[0];
                      if (canEdit && topP !== undefined) onChange({ ...value, topP: topP < 0 ? undefined : topP });
                    }}
                  />
                  <Txt as="p" variant="ui-sm" className="text-neutral3">
                    {value.topP ?? 'n/a'}
                  </Txt>
                </div>
              </Entry>
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  icon={<RotateCcw />}
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={!canEdit}
                  onClick={() => {
                    if (canEdit) onReset();
                  }}
                >
                  Reset
                </Button>
                <Button
                  icon={<Settings2 />}
                  variant="default"
                  size="sm"
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setAdvancedOpen(true)}
                >
                  Advanced Settings
                </Button>
              </div>
            </section>
          )}
        </PopoverContent>
      </Popover>
      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Advanced model settings</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <AgentAdvancedSettingsBody canEdit={canEdit} value={value} onChange={onChange} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
