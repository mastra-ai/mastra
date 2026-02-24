import type { StorageBackend } from '../../onboarding/settings.js';
import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { SettingsComponent } from '../components/settings.js';
import type { NotificationMode } from '../notify.js';
import type { SlashCommandContext } from './types.js';

export async function handleSettingsCommand(ctx: SlashCommandContext): Promise<void> {
  const state = ctx.state.harness.getState() as any;
  const globalSettings = loadSettings();
  const config = {
    notifications: (state?.notifications ?? 'off') as NotificationMode,
    yolo: state?.yolo === true,
    thinkingLevel: (state?.thinkingLevel ?? 'off') as string,
    escapeAsCancel: ctx.state.editor.escapeEnabled,
    storageBackend: globalSettings.storage.backend,
    pgConnectionString: globalSettings.storage.pg?.connectionString ?? '',
    libsqlUrl: globalSettings.storage.libsql?.url ?? '',
  };

  return new Promise<void>(resolve => {
    const settings = new SettingsComponent(config, {
      onNotificationsChange: async mode => {
        await ctx.state.harness.setState({ notifications: mode });
        ctx.showInfo(`Notifications: ${mode}`);
      },
      onYoloChange: async enabled => {
        await ctx.state.harness.setState({ yolo: enabled } as any);
      },
      onThinkingLevelChange: async level => {
        await ctx.state.harness.setState({ thinkingLevel: level } as any);
      },
      onEscapeAsCancelChange: async enabled => {
        ctx.state.editor.escapeEnabled = enabled;
        await ctx.state.harness.setState({ escapeAsCancel: enabled });
        await ctx.state.harness.setThreadSetting({ key: 'escapeAsCancel', value: enabled });
      },
      onStorageBackendChange: (backend: StorageBackend, connectionUrl?: string) => {
        const current = loadSettings();
        current.storage.backend = backend;
        if (backend === 'pg' && connectionUrl !== undefined) {
          current.storage.pg = { ...current.storage.pg, connectionString: connectionUrl };
        } else if (backend === 'libsql') {
          current.storage.libsql = { ...current.storage.libsql, url: connectionUrl || undefined };
        }
        saveSettings(current);
        ctx.state.ui.hideOverlay();
        ctx.stop();
        const label = backend === 'pg' ? 'PostgreSQL' : 'LibSQL';
        console.info(`\nStorage backend changed to ${label}. Restarting is required.\n`);
        process.exit(0);
      },
      onClose: () => {
        ctx.state.ui.hideOverlay();
        resolve();
      },
    });

    ctx.state.ui.showOverlay(settings, {
      width: '60%',
      maxHeight: '50%',
      anchor: 'center',
    });
    settings.focused = true;
  });
}
