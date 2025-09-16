import { InputField, TextareaField, SliderField, RadioGroupField } from '@/components/ui/elements';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/elements/buttons';
import { useEffect, useState } from 'react';
import { RotateCcwIcon, Undo2Icon, Wand2Icon } from 'lucide-react';

type AgentDetailsViewProps = {
  prompt: string;
  settings: any[];
  currentVersion: string;
  onSave: (val: any) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

export const AgentDetailsEdit = ({
  settings: initialSettings,
  onSave,
  onCancel,
  isSaving = false,
  prompt: initialPrompt,
}: AgentDetailsViewProps) => {
  const [settings, setSettings] = useState(initialSettings);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [settingsIsChanged, setSettingsIsChanged] = useState(false);
  const [enhancementInstruction, setEnhancementInstruction] = useState('');

  useEffect(() => {
    // filters out 'chatWithGenerate' from settings comparison, because it's not relevant for CMS
    const settingsToCompare = [...settings].filter(item => item.key !== 'chatWithGenerate');
    const initialSettingsToCompare = [...initialSettings].filter(item => item.key !== 'chatWithGenerate');

    if (
      !settingsIsChanged &&
      (JSON.stringify(initialSettingsToCompare) !== JSON.stringify(settingsToCompare) || prompt !== initialPrompt)
    ) {
      setSettingsIsChanged(true);
    } else if (
      settingsIsChanged &&
      JSON.stringify(initialSettingsToCompare) === JSON.stringify(settingsToCompare) &&
      initialPrompt === prompt
    ) {
      setSettingsIsChanged(false);
    }
  }, [initialSettings, settings, initialPrompt, prompt, settingsIsChanged]);

  const handleSliderChange = (value: number[], name: string) => {
    const val = value[0]; // Assuming single value slider
    setSettings(prevSettings =>
      prevSettings.map(setting => (setting.key === name ? { ...setting, value: val } : setting)),
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prevSettings => prevSettings.map(setting => (setting.key === name ? { ...setting, value } : setting)));
  };

  const handleRadioChange = (value: string, name: string) => {
    setSettings(prevSettings => prevSettings.map(setting => (setting.key === name ? { ...setting, value } : setting)));
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleReset = () => {
    setSettings(initialSettings);
    setPrompt(initialPrompt);
    setEnhancementInstruction('');
  };

  return (
    <div className="grid gap-[1rem]">
      <div className="grid gap-0">
        <TextareaField
          name="instructions"
          label="System Prompt"
          onChange={handlePromptChange}
          placeholder="Enter agent instructions"
          value={prompt}
          className="[&>textarea]:font-mono [&>textarea]:text-[0.84375rem] gap-0 min-h-[18rem] [&>textarea]:rounded-b-none [&>label]:mb-[0.5rem]"
        />
        <TextareaField
          name="enhancement"
          onChange={e => setEnhancementInstruction(e.target.value)}
          placeholder="Add your comments or requirements for enhancing the agent's prompt..."
          value={enhancementInstruction}
          className="gap-0 [&>textarea]:rounded-none [&>textarea]:border-y-0 bg-[#191919]"
        />
        <Button onClick={() => console.log('Enhance Prompt Clicked')} className="w-full bg-[#191919] rounded-t-none">
          Enhance Prompt <Wand2Icon />
        </Button>
      </div>

      <div className={cn('grid gap-x-[2rem] gap-[1.5rem] mt-[1rem]', '2xl:grid-cols-2 4xl:grid-cols-3')}>
        {settings.map(item => {
          if (item.field === 'slider') {
            return (
              <SliderField
                key={item.key}
                name={item.key}
                label={item.label}
                value={[item.value]}
                onValueChange={v => handleSliderChange(v, item.key)}
                min={item.min}
                max={item.max}
                step={item.step}
                className=""
              />
            );
          } else if (item.field === 'textarea') {
            return (
              <TextareaField
                key={item.key}
                name={item.key}
                label={item.label}
                value={item.value || ''}
                onChange={() => console.log('Textarea change')}
                placeholder={item.placeholder}
                className={cn('2xl:col-span-2 4xl:col-span-3')}
              />
            );
          } else if (item.field === 'radio') {
            return (
              <RadioGroupField
                key={item.key}
                name={item.key}
                label={item.label}
                value={item.value || ''}
                onValueChange={v => handleRadioChange(v, item.key)}
                layout={item.layout}
                options={item.options}
                className={cn('2xl:col-span-2 4xl:col-span-3')}
              />
            );
          } else {
            return (
              <InputField
                key={item.key}
                name={item.key}
                label={item.label}
                value={item.value || ''}
                onChange={handleInputChange}
                placeholder={item.placeholder}
                className={cn('w-full', item.className)}
                type={item.type || 'text'}
              />
            );
          }
        })}
      </div>
      <div className="sticky bottom-0 bg-surface2 py-[1.5rem] grid gap-[1rem]">
        {settingsIsChanged && (
          <div className="bg-surface5 p-[1rem] py-[1rem] grid gap-[1rem] rounded-lg">
            <p className=" text-icon4 text-[0.875rem] rounded-lg">
              Settings have been changed. Would you like to store the changes as a new Settings Version?
            </p>
            <Button onClick={onSave} className="w-full bg-surface5">
              Save as new Version
            </Button>
          </div>
        )}
        <div className="grid grid-cols-[1fr_1fr] gap-[1rem]">
          <Button onClick={onCancel} variant="primary">
            <Undo2Icon /> Cancel
          </Button>
          <Button onClick={handleReset} disabled={!settingsIsChanged || isSaving}>
            Reset <RotateCcwIcon />
          </Button>
        </div>
      </div>
    </div>
  );
};
