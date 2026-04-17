import type { PlaygroundTheme } from '@mastra/playground-ui';
import { PageHeader, PageLayout, usePlaygroundStore } from '@mastra/playground-ui';
import { ArrowLeftIcon, MoonIcon, PaletteIcon, SunIcon, MonitorIcon } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';

const options: Array<{ value: PlaygroundTheme; label: string; icon: React.ReactNode }> = [
  { value: 'light', label: 'Light', icon: <SunIcon className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <MonitorIcon className="h-4 w-4" /> },
];

export function AgentStudioConfigureAppearance() {
  const theme = usePlaygroundStore(state => state.theme);
  const setTheme = usePlaygroundStore(state => state.setTheme);
  const { Link } = useLinkComponent();

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <Link
              href="/agent-studio/configure"
              className="inline-flex items-center gap-1 text-sm text-icon4 hover:text-icon6"
            >
              <ArrowLeftIcon className="h-4 w-4" /> Back to Configure
            </Link>
            <PageHeader>
              <PageHeader.Title>
                <PaletteIcon /> Appearance
              </PageHeader.Title>
              <PageHeader.Description>Pick a theme for your Agent Studio experience.</PageHeader.Description>
            </PageHeader>
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      <div className="p-4">
        <div
          role="radiogroup"
          aria-label="Theme"
          className="grid gap-3 max-w-xl"
          style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
          data-testid="appearance-options"
        >
          {options.map(option => {
            const isSelected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setTheme(option.value)}
                data-testid={`appearance-option-${option.value}`}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
                  isSelected
                    ? 'border-border2 bg-surface3'
                    : 'border-border1 bg-surface2 hover:border-border2 hover:bg-surface3',
                )}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {option.icon}
                  {option.label}
                </div>
                <span className="text-xs text-icon4">
                  {option.value === 'system'
                    ? 'Match your operating system preference'
                    : `Use the ${option.label.toLowerCase()} theme`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
}

export default AgentStudioConfigureAppearance;
