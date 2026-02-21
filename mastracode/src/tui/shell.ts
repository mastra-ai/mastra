/**
 * Shell passthrough: execute a shell command and display the output in the TUI.
 */
import { ShellOutputComponent } from './components/shell-output.js';
import { showError, showInfo } from './display.js';
import type { TUIState } from './state.js';

export async function handleShellPassthrough(state: TUIState, command: string): Promise<void> {
  if (!command) {
    showInfo(state, 'Usage: !<command> (e.g., !ls -la)');
    return;
  }

  try {
    const { execa } = await import('execa');
    const result = await execa(command, {
      shell: true,
      cwd: process.cwd(),
      reject: false,
      timeout: 30_000,
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
    });

    const component = new ShellOutputComponent(command, result.stdout ?? '', result.stderr ?? '', result.exitCode ?? 0);
    state.chatContainer.addChild(component);
    state.ui.requestRender();
  } catch (error) {
    showError(state, error instanceof Error ? error.message : 'Shell command failed');
  }
}
