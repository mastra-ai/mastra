import { spawn, type ChildProcess } from 'node:child_process';
import { access, rm } from 'node:fs/promises';
import { killProcessGroup } from './command.js';

export class OwnedResources {
  readonly processes = new Map<number, ChildProcess>();
  readonly paths = new Set<string>();

  trackProcess(child: ChildProcess) {
    if (child.pid) this.processes.set(child.pid, child);
    return child;
  }

  trackPath(path: string) {
    this.paths.add(path);
    return path;
  }

  spawn(command: string, args: string[], cwd: string) {
    return this.trackProcess(spawn(command, args, { cwd, detached: process.platform !== 'win32', stdio: 'ignore' }));
  }

  async cleanup() {
    const processEvidence: Array<{ pid: number; exited: boolean; escalated: boolean }> = [];
    for (const [pid, child] of this.processes) {
      let escalated = false;
      if (child.exitCode === null && child.signalCode === null) {
        killProcessGroup(pid);
        await wait(500);
      }
      if (child.exitCode === null && child.signalCode === null) {
        escalated = true;
        killProcessGroup(pid, 'SIGKILL');
        await wait(500);
      }
      processEvidence.push({ pid, exited: child.exitCode !== null || child.signalCode !== null, escalated });
    }
    for (const path of this.paths) await rm(path, { recursive: true, force: true });
    const remainingPaths = [];
    for (const path of this.paths) {
      try {
        await access(path);
        remainingPaths.push(path);
      } catch {}
    }
    return { processes: processEvidence, remainingPaths };
  }
}

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
