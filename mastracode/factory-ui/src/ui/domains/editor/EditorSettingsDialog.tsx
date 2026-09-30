import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, Paintbrush, SlidersHorizontal, Sparkles, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { EDITOR_THEMES, editorThemeStyle, type EditorThemeId } from './editor-themes';
import { FONT_SIZES, TAB_SIZES, type EditorSettings } from './editor-settings';

type SectionId = 'appearance' | 'editor' | 'intelligence' | 'collaboration';

const SECTIONS: { id: SectionId; label: string; icon: ReactNode }[] = [
  { id: 'appearance', label: 'Appearance', icon: <Paintbrush className="size-4 shrink-0" /> },
  { id: 'editor', label: 'Editor', icon: <SlidersHorizontal className="size-4 shrink-0" /> },
  { id: 'intelligence', label: 'Code intelligence', icon: <Sparkles className="size-4 shrink-0" /> },
  { id: 'collaboration', label: 'Collaboration', icon: <Users className="size-4 shrink-0" /> },
];

interface EditorSettingsDialogProps {
  open: boolean;
  settings: EditorSettings;
  theme: EditorThemeId;
  onOpenChange(open: boolean): void;
  onSettingsChange(next: EditorSettings): void;
  onThemeChange(id: EditorThemeId): void;
}

/**
 * Static sample rendered with the shared `.tok-*` palette. Because presets are
 * scoped CSS-variable overrides, wrapping the sample in `data-editor-theme`
 * previews each theme live without mounting an editor.
 */
function ThemeSample() {
  return (
    <pre className="text-caption overflow-hidden rounded-md px-3 py-2 font-mono leading-relaxed">
      <span className="tok-comment">{'// hello\n'}</span>
      <span className="tok-keyword">const</span> <span className="tok-variable">answer</span>{' '}
      <span className="tok-operator">=</span> <span className="tok-number">42</span>
      <span className="tok-punctuation">;</span>
      {'\n'}
      <span className="tok-controlKeyword">return</span> <span className="tok-function">greet</span>
      <span className="tok-punctuation">(</span>
      <span className="tok-string">'world'</span>
      <span className="tok-punctuation">)</span>
    </pre>
  );
}

/** One labeled row: title + description on the left, control on the right. */
function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <Txt variant="label" className="text-foreground block">
          {label}
        </Txt>
        <Txt variant="caption" className="text-muted-foreground block">
          {description}
        </Txt>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function EditorSettingsDialog({
  open,
  settings,
  theme,
  onOpenChange,
  onSettingsChange,
  onThemeChange,
}: EditorSettingsDialogProps) {
  const [section, setSection] = useState<SectionId>('appearance');

  const set = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) =>
    onSettingsChange({ ...settings, [key]: value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editor settings</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-[26rem] gap-4">
          <nav className="w-44 shrink-0" aria-label="Settings sections">
            {SECTIONS.map(item => (
              <button
                key={item.id}
                type="button"
                aria-pressed={section === item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  'text-body-sm flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                  section === item.id
                    ? 'bg-fill text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-fill-subtle',
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
          <div className="border-border min-h-0 min-w-0 flex-1 overflow-y-auto border-l pl-4">
            {section === 'appearance' && (
              <div>
                <SettingRow
                  label="Font size"
                  description="Editor text size in pixels."
                  control={
                    <Select value={String(settings.fontSize)} onValueChange={next => set('fontSize', Number(next))}>
                      <SelectTrigger size="sm" aria-label="Font size" className="w-20">
                        {settings.fontSize}px
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_SIZES.map(size => (
                          <SelectItem key={size} value={String(size)}>
                            {size}px
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />
                <div className="pt-2">
                  <Txt variant="label" className="text-foreground block pb-2">
                    Theme
                  </Txt>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {EDITOR_THEMES.map(preset => {
                      const selected = preset.id === theme;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onThemeChange(preset.id)}
                          aria-pressed={selected}
                          className={cn(
                            'rounded-lg border p-2 text-left transition-colors',
                            selected ? 'border-border-strong bg-fill' : 'border-border hover:bg-fill-subtle',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Txt variant="label" className="text-foreground">
                              {preset.name}
                            </Txt>
                            {selected ? <Check className="text-foreground size-3.5 shrink-0" /> : null}
                          </div>
                          <Txt variant="caption" className="text-muted-foreground mt-0.5 block">
                            {preset.description}
                          </Txt>
                          <div
                            data-editor-theme={preset.id}
                            style={editorThemeStyle(preset.id)}
                            className="border-border mt-2 rounded-md border"
                          >
                            <ThemeSample />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {section === 'editor' && (
              <div className="divide-border divide-y">
                <SettingRow
                  label="Tab size"
                  description="Spaces inserted per indent step."
                  control={
                    <Select
                      value={String(settings.tabSize)}
                      onValueChange={next => set('tabSize', Number(next) as EditorSettings['tabSize'])}
                    >
                      <SelectTrigger size="sm" aria-label="Tab size" className="w-16">
                        {settings.tabSize}
                      </SelectTrigger>
                      <SelectContent>
                        {TAB_SIZES.map(size => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                />
                <SettingRow
                  label="Word wrap"
                  description="Wrap long lines instead of scrolling horizontally."
                  control={<Switch checked={settings.wordWrap} onCheckedChange={next => set('wordWrap', next)} />}
                />
                <SettingRow
                  label="Line numbers"
                  description="Show the line number gutter."
                  control={<Switch checked={settings.lineNumbers} onCheckedChange={next => set('lineNumbers', next)} />}
                />
                <SettingRow
                  label="Autocomplete"
                  description="Suggest completions while typing."
                  control={
                    <Switch checked={settings.autocomplete} onCheckedChange={next => set('autocomplete', next)} />
                  }
                />
              </div>
            )}
            {section === 'intelligence' && (
              <div className="divide-border divide-y">
                <SettingRow
                  label="Hover documentation"
                  description="Type signatures and docs when hovering a symbol."
                  control={<Switch checked={settings.hoverDocs} onCheckedChange={next => set('hoverDocs', next)} />}
                />
                <SettingRow
                  label="Diagnostics"
                  description="Type errors and warnings as squiggles in the buffer."
                  control={<Switch checked={settings.diagnostics} onCheckedChange={next => set('diagnostics', next)} />}
                />
                <SettingRow
                  label="Format on save"
                  description="Run the language server's formatter before every save."
                  control={
                    <Switch checked={settings.formatOnSave} onCheckedChange={next => set('formatOnSave', next)} />
                  }
                />
              </div>
            )}
            {section === 'collaboration' && (
              <div className="divide-border divide-y">
                <SettingRow
                  label="Multiplayer editing"
                  description="Share live edits and cursors with others in this file."
                  control={<Switch checked={settings.multiplayer} onCheckedChange={next => set('multiplayer', next)} />}
                />
                <SettingRow
                  label="Display name"
                  description="Shown on your cursor to collaborators."
                  control={
                    <input
                      value={settings.displayName}
                      onChange={event => set('displayName', event.target.value.slice(0, 32))}
                      placeholder="Anonymous animal"
                      spellCheck={false}
                      className="text-body-sm bg-field border-border focus:border-border-focus placeholder:text-placeholder w-40 rounded-md border px-2 py-1 outline-none"
                    />
                  }
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
