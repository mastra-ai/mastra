import { KeyValueList, SelectField } from '@/components/ui/elements';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/elements/buttons';
import { SettingsIcon } from 'lucide-react';

type AgentDetailsViewProps = {
  prompt: string;
  settings: any[];
  LinkComponent: any;
  versionOptions: { value: string; label: string }[];
  currentVersion: string;
  onVersionChange: (value: string) => void;
  onCustomizeClick: () => void;
};

export const AgentDetailsView = ({
  LinkComponent,
  prompt,
  settings,
  currentVersion,
  onVersionChange,
  onCustomizeClick,
  versionOptions,
}: AgentDetailsViewProps) => {
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto] gap-4  items-end">
        <SelectField label="Version" value={currentVersion} onValueChange={onVersionChange} options={versionOptions} />
        <Button onClick={onCustomizeClick}>
          Customize
          <SettingsIcon />
        </Button>
      </div>
      <div className={cn('grid text-[0.875rem] text-icon5 gap-[1rem] justify-items-start my-[2rem]')}>
        <span className="text-[0.875rem] text-icon3 border-b border-border1 pb-[.5rem] pr-[1rem]">System Prompt</span>
        <pre className="whitespace-pre-wrap font-mono text-[0.8125rem] border-b border-border1 max-h-[25rem] overflow-y-auto">
          {prompt}
        </pre>
      </div>

      <KeyValueList data={settings} LinkComponent={LinkComponent} />
    </div>
  );
};
