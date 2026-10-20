import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import type { WorkspaceProcessListing, WorkspaceProcessOutput } from '../../../../../api/types';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { WorkspaceViewerPanel } from '../WorkspaceViewerPanel';

const WORKSPACE = 'session-1';
const PROCESSES_URL = `${TEST_BASE_URL}/web/workspace/processes`;
const PROCESS_URL = `${TEST_BASE_URL}/web/workspace/process`;
const KILL_URL = `${TEST_BASE_URL}/web/workspace/process/kill`;

type Proc = WorkspaceProcessOutput;

/** A sandbox whose processes the test changes between polls. */
function installSandbox(
  procs: Proc[],
  {
    available = true,
    supported = true,
    killError,
  }: { available?: boolean; supported?: boolean; killError?: string } = {},
) {
  const reads: string[] = [];
  const kills: string[] = [];
  server.use(
    http.get(PROCESSES_URL, () =>
      HttpResponse.json<WorkspaceProcessListing>({
        workspacePath: WORKSPACE,
        available,
        supported,
        processes:
          available && supported
            ? procs.map(({ pid, command, running, exitCode }) => ({ pid, command, running, exitCode }))
            : [],
      }),
    ),
    http.get(PROCESS_URL, ({ request }) => {
      const pid = new URL(request.url).searchParams.get('pid')!;
      reads.push(pid);
      const proc = procs.find(candidate => candidate.pid === pid);
      return proc ? HttpResponse.json(proc) : HttpResponse.json({ error: `Process ${pid} not found` }, { status: 404 });
    }),
    http.post(KILL_URL, async ({ request }) => {
      const { pid } = (await request.json()) as { pid: string };
      kills.push(pid);
      if (killError) return HttpResponse.json({ error: killError }, { status: 500 });
      const proc = procs.find(candidate => candidate.pid === pid)!;
      Object.assign(proc, { running: false, exitCode: -1 });
      return HttpResponse.json({ killed: true });
    }),
    http.get(`${TEST_BASE_URL}/web/workspace/changes`, () =>
      HttpResponse.json({ workspacePath: WORKSPACE, available, changes: [] }),
    ),
  );
  return { reads, kills };
}

function proc(overrides: Partial<Proc> & Pick<Proc, 'pid'>): Proc {
  return {
    command: 'pnpm dev',
    running: true,
    stdout: '',
    stderr: '',
    stdoutTruncated: false,
    stderrTruncated: false,
    attached: false,
    ...overrides,
  };
}

async function openProcesses() {
  const user = userEvent.setup();
  renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
  await user.click(await screen.findByRole('button', { name: /Processes/ }));
  return user;
}

describe('Processes in the workspace sidebar', () => {
  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('goes back from a process in a browser whose scrolling returns a promise', async () => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => Promise.resolve(),
    });
    installSandbox([proc({ pid: '1', stdout: 'tick\n' })]);
    const user = await openProcesses();
    await user.click(await screen.findByRole('button', { name: /pnpm dev/ }));
    expect(await screen.findByText('tick')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByRole('button', { name: /pnpm dev/ })).toBeInTheDocument();
  });

  it('hides Processes when the sandbox has no process manager', async () => {
    installSandbox([], { supported: false });
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await screen.findByRole('button', { name: /Files/ });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Processes/ })).not.toBeInTheDocument());
  });

  it('shows Processes with how many are running', async () => {
    installSandbox([proc({ pid: '1' }), proc({ pid: '2', command: 'pnpm build', running: false, exitCode: 0 })]);
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Processes/ })).toHaveTextContent('1 running'));
  });

  it('lists running and exited processes', async () => {
    installSandbox([
      proc({ pid: '1', command: 'pnpm dev' }),
      proc({ pid: '2', command: 'pnpm build', running: false, exitCode: 2 }),
    ]);
    await openProcesses();

    expect(await screen.findByRole('button', { name: /pnpm dev/ })).toHaveTextContent('Running');
    expect(screen.getByRole('button', { name: /pnpm build/ })).toHaveTextContent('Exited 2');
  });

  it('offers to wake the sandbox when it is not running', async () => {
    installSandbox([], { available: false });
    await openProcesses();

    expect(await screen.findByRole('button', { name: 'Wake sandbox' })).toBeInTheDocument();
  });

  it('says when there are no processes', async () => {
    installSandbox([]);
    await openProcesses();

    expect(await screen.findByText('No processes')).toBeInTheDocument();
  });

  it('shows new output on the next poll, and stops polling once the process exits', async () => {
    const dev = proc({ pid: '1', stdout: 'starting\n' });
    const { reads } = installSandbox([dev]);
    const user = await openProcesses();
    await user.click(await screen.findByRole('button', { name: /pnpm dev/ }));
    expect(await screen.findByText('starting')).toBeInTheDocument();

    Object.assign(dev, { stdout: 'starting\nready on :3000\n', stderr: 'warn: slow\n' });
    expect(await screen.findByText(/ready on :3000/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('warn: slow')).toBeInTheDocument();

    Object.assign(dev, { running: false, exitCode: 0 });
    expect(await screen.findByText('Exited 0', {}, { timeout: 3000 })).toBeInTheDocument();
    const readsAtExit = reads.length;
    await new Promise(resolve => setTimeout(resolve, 2500));
    expect(reads.length).toBe(readsAtExit);
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
  });

  it('stops the process it shows', async () => {
    const { kills } = installSandbox([proc({ pid: '7', stdout: 'listening\n' })]);
    const user = await openProcesses();
    await user.click(await screen.findByRole('button', { name: /pnpm dev/ }));

    await user.click(await screen.findByRole('button', { name: 'Stop' }));

    expect(await screen.findByText('Exited -1')).toBeInTheDocument();
    expect(kills).toEqual(['7']);
    expect(screen.getByText('listening')).toBeInTheDocument();
  });

  it('shows why a process could not be stopped', async () => {
    installSandbox([proc({ pid: '7' })], { killError: 'sandbox went away' });
    const user = await openProcesses();
    await user.click(await screen.findByRole('button', { name: /pnpm dev/ }));

    await user.click(await screen.findByRole('button', { name: 'Stop' }));

    expect(await screen.findByText('sandbox went away')).toBeInTheDocument();
  });

  it('notes that an attached process only has output from after attaching', async () => {
    installSandbox([proc({ pid: '9', command: 'node worker.js', attached: true, stdout: 'tick\n' })]);
    const user = await openProcesses();
    await user.click(await screen.findByRole('button', { name: /node worker.js/ }));

    expect(await screen.findByText('Output since this process was attached.')).toBeInTheDocument();
  });
});
