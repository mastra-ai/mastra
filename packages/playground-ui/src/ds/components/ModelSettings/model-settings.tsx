import { Info, Settings2, RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
import { AdvancedModelSettings } from './advanced-model-settings';
import type { ModelSettingsValues } from './types';
import { Button } from '@/ds/components/Button';
import { Checkbox } from '@/ds/components/Checkbox';
import { ComposerModelSettingsButton } from '@/ds/components/Composer';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { Entry } from '@/ds/components/Entry';
import { Label } from '@/ds/components/Label';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { Skeleton } from '@/ds/components/Skeleton';
import { Slider } from '@/ds/components/Slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface ModelSettingsMethod {
  value: string;
  label: string;
  unavailable?: string;
}
export interface ModelSettingsProps {
  value: ModelSettingsValues;
  onChange: (value: ModelSettingsValues) => void;
  method?: string;
  methods: ModelSettingsMethod[];
  onMethodChange: (method: string) => void;
  onReset: () => void;
  canEdit?: boolean;
  loading?: boolean;
  samplingNotice?: string;
}

function MethodRadio({ option, disabled, id }: { option: ModelSettingsMethod; disabled: boolean; id: string }) {
  const radio = (
    <div className="flex items-center gap-2">
      <RadioGroupItem
        value={option.value}
        id={id}
        className="text-neutral6"
        disabled={disabled || Boolean(option.unavailable)}
      />
      <Label
        className={cn('text-ui-md text-neutral6', option.unavailable && 'cursor-not-allowed text-neutral3!')}
        htmlFor={id}
      >
        {option.label}
      </Label>
    </div>
  );
  if (!option.unavailable) return radio;
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>{radio}</TooltipTrigger>
      <TooltipContent>
        <p>{option.unavailable}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ModelSettings({
  value,
  onChange,
  method,
  methods,
  onMethodChange,
  onReset,
  canEdit = true,
  loading,
  samplingNotice,
}: ModelSettingsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const methodId = useId();
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
              <Entry label="Chat Method">
                <RadioGroup
                  value={method}
                  disabled={!canEdit}
                  onValueChange={selected => {
                    if (canEdit) onMethodChange(selected);
                  }}
                  className="flex flex-col gap-3"
                >
                  {methods.map(option => (
                    <MethodRadio
                      key={option.value}
                      option={option}
                      disabled={!canEdit}
                      id={`${methodId}-${option.value}`}
                    />
                  ))}
                </RadioGroup>
              </Entry>
              <Entry label="Require Tool Approval">
                <Checkbox
                  checked={value.requireToolApproval}
                  disabled={!canEdit}
                  onCheckedChange={checked => {
                    if (canEdit) onChange({ ...value, requireToolApproval: checked });
                  }}
                />
              </Entry>
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
            <AdvancedModelSettings canEdit={canEdit} value={value} onChange={onChange} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
