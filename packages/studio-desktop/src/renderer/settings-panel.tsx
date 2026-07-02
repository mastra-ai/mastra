import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Section } from '@mastra/playground-ui/components/Section';

import { LocalModelSetup, RuntimeEnvironmentSetup } from './runtime-settings';
import type { RuntimeSettingsProps } from './runtime-settings';

export interface SettingsPanelProps extends RuntimeSettingsProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose, ...runtimeSettings }: SettingsPanelProps) {
  if (!open) return null;

  return (
    <div className="settings-overlay" role="presentation">
      <button className="settings-backdrop" type="button" aria-label="Close settings" onClick={onClose} />
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-panel-header">
          <span>
            <Badge size="xs">Desktop</Badge>
            <h2 id="settings-title">Settings</h2>
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="settings-panel-body">
          <Section className="settings-help">
            <h3>Local setup</h3>
            <ul>
              <li>LM Studio: start the local server, load a model, probe models, then apply and restart.</li>
              <li>Ollama: start Ollama, pull a chat model, probe the OpenAI-compatible endpoint, then apply.</li>
              <li>If LM Studio auth is enabled, create the token in LM Studio and add it as LM_API_TOKEN.</li>
            </ul>
          </Section>

          <LocalModelSetup {...runtimeSettings} />
          <RuntimeEnvironmentSetup {...runtimeSettings} />

          <ButtonsGroup className="settings-footer-actions" spacing="default">
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              Done
            </Button>
          </ButtonsGroup>
        </div>
      </aside>
    </div>
  );
}

