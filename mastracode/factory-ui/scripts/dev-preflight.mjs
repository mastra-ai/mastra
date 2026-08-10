#!/usr/bin/env node
/**
 * Reconcile the dev ports before `pnpm web` starts both halves of the stack.
 *
 * When the API crashes, its `varlock`/`mastra factory dev` wrapper outlives the
 * crashed child, so `run-p --race` never fires and Vite keeps serving a dead
 * stack. The next `pnpm web` then dies on "Port 5173 is already in use", which
 * says nothing about the real state. Read the ports instead and act on it.
 */
import { execFileSync } from 'node:child_process';
import net from 'node:net';

const UI_PORT = Number(process.env.MASTRACODE_UI_PORT ?? 5173);
const API_PORT = Number(process.env.PORT ?? 4111);

function isListening(port) {
  return new Promise(resolve => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const settle = result => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(500);
    socket.on('connect', () => settle(true));
    socket.on('error', () => settle(false));
    socket.on('timeout', () => settle(false));
  });
}

function listenerPids(port) {
  try {
    return execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .map(Number);
  } catch {
    return [];
  }
}

function commandOf(pid) {
  try {
    return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

async function waitUntilFree(port) {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!(await isListening(port))) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

const [uiUp, apiUp] = await Promise.all([isListening(UI_PORT), isListening(API_PORT)]);

if (apiUp && uiUp) {
  console.log(`Dev stack already running — http://localhost:${UI_PORT}`);
  process.exit(1);
}

if (apiUp) {
  console.log(`API already running on :${API_PORT} — start the UI alone with \`pnpm dev\`.`);
  process.exit(1);
}

if (uiUp) {
  const pids = listenerPids(UI_PORT);
  // Only ever reap our own dev server: a foreign listener is the user's business.
  const ours = pids.filter(pid => commandOf(pid).includes('factory-ui'));
  if (!pids.length || ours.length !== pids.length) {
    console.error(`Port ${UI_PORT} is taken by a process this script did not start:`);
    for (const pid of pids) console.error(`  ${pid}  ${commandOf(pid)}`);
    process.exit(1);
  }

  console.log(`Vite on :${UI_PORT} outlived a dead API — stopping it (pid ${ours.join(', ')}).`);
  for (const pid of ours) process.kill(pid, 'SIGTERM');
  if (!(await waitUntilFree(UI_PORT))) {
    for (const pid of ours) process.kill(pid, 'SIGKILL');
    await waitUntilFree(UI_PORT);
  }
}
