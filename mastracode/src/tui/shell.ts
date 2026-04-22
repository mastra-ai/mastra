/**
 * Shell passthrough: execute a shell command and display the output in the TUI.
 * Streams stdout/stderr in real-time using a bordered box that rebuilds on each chunk.
 */
import { ShellStreamComponent } from './components/shell-output.js';
import { showError, showInfo } from './display.js';
import type { TUIState } from './state.js';

export async function handleShellPassthrough(state: TUIState, command: string): Promise<void> {
  if (!command) {
    showInfo(state, 'Usage: !<command> (e.g., !ls -la)');
    return;
  }

  const component = new ShellStreamComponent(command);
  if (state.toolOutputExpanded) {
    component.setExpanded(true);
  }
  state.allShellComponents.push(component);
  state.chatContainer.addChild(component);
  state.ui.requestRender();

  try {
    const { execa } = await import('execa');

    const subprocess = execa(command, {
      shell: true,
      cwd: process.cwd(),
      reject: false,
      timeout: 30_000,
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
    });

    // Stream stdout/stderr as it arrives
    if (subprocess.stdout) {
      subprocess.stdout.setEncoding('utf8');
      subprocess.stdout.on('data', (chunk: string) => {
        component.appendOutput(chunk);
        state.ui.requestRender();
      });
    }
    if (subprocess.stderr) {
      subprocess.stderr.setEncoding('utf8');
      subprocess.stderr.on('data', (chunk: string) => {
        component.appendOutput(chunk);
        state.ui.requestRender();
      });
    }

    // Wait for the process to complete
    const result = await subprocess;

    component.finish(result.exitCode ?? 0);
    state.ui.requestRender();
  } catch (error) {
    component.finish(1);
    state.ui.requestRender();
    showError(state, error instanceof Error ? error.message : 'Shell command failed');
  }
}
