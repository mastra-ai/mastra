import { SettingsComponent } from '../components/settings.js';
import type { NotificationMode } from '../notify.js';
import type { SlashCommandContext } from './types.js';

export async function handleSettingsCommand(ctx: SlashCommandContext): Promise<void> {
  const state = ctx.state.harness.getState() as any;
  const config = {
    notifications: (state?.notifications ?? 'off') as NotificationMode,
    yolo: state?.yolo === true,
    thinkingLevel: (state?.thinkingLevel ?? 'off') as string,
    escapeAsCancel: ctx.state.editor.escapeEnabled,
  };

  return new Promise<void>(resolve => {
    const settings = new SettingsComponent(config, {
      onNotificationsChange: async mode => {
        await ctx.state.harness.setState({ notifications: mode });
        ctx.showInfo(`Notifications: ${mode}`);
      },
      onYoloChange: async enabled => {
        await ctx.state.harness.setState({ yolo: enabled } as any);
        ctx.updateStatusLine();
      },
      onThinkingLevelChange: async level => {
        await ctx.state.harness.setState({ thinkingLevel: level } as any);
        ctx.updateStatusLine();
      },
      onEscapeAsCancelChange: async enabled => {
        ctx.state.editor.escapeEnabled = enabled;
        await ctx.state.harness.setState({ escapeAsCancel: enabled });
        await ctx.state.harness.setThreadSetting({ key: 'escapeAsCancel', value: enabled });
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
