import { randomUUID } from 'node:crypto';
import type { CommandResult, ExecuteCommandOptions } from '@mastra/core/workspace';
import type { Render } from '@renderinc/sdk';
import { RenderSandboxError } from './errors.js';
import { bounded, deadline, OutputTail, quote } from './utils.js';

type Api = Render['experimental']['sandboxes'];

// A supervisor owns the process group. The stop helper talks to that supervisor,
// never reads an arbitrary PID from a file or signals an independently reused PID.
// This requires Linux, python3 and /proc, all verified in Render's base image.
export const supervisor = String.raw`
import os,sys,socket,subprocess,json,time,signal,shutil,ctypes
root,token,command,timeout=sys.argv[1:]
os.umask(0o077)
os.mkdir(root,0o700)
try:
 ctypes.CDLL(None).prctl(36,1,0,0,0) # reap orphaned ordinary descendants
 server=socket.socket(socket.AF_UNIX)
 server.bind(root+'/control')
 server.listen(8)
 server.settimeout(0.02)
 process=subprocess.Popen(['bash','-c',command],start_new_session=True)
 pgid=process.pid
 started=time.monotonic()
 report={'token':token,'killed':False,'timedOut':False}
 def members():
  found=[]
  for entry in os.scandir('/proc'):
   if not entry.name.isdigit(): continue
   try:
    fields=open(entry.path+'/stat').read().rsplit(')',1)[1].split()
    if int(fields[2])==pgid and fields[0]!='Z': found.append(int(entry.name))
   except (FileNotFoundError,ProcessLookupError): pass
  return found
 def reap():
  # WNOWAIT leaves the leader's PID reserved until all group signalling is over.
  # Reaping it early would permit PID/PGID reuse before a racing cancel request.
  return os.waitid(os.P_PID,process.pid,os.WEXITED|os.WNOHANG|os.WNOWAIT)
 def stop(reason):
  if not members():
   reap()
   return report
  try:
   os.killpg(pgid,signal.SIGSTOP)
   os.killpg(pgid,signal.SIGKILL)
  except ProcessLookupError: return report
  until=time.monotonic()+5
  while members() and time.monotonic()<until:
   reap(); time.sleep(0.01)
  if members(): raise RuntimeError('Process group termination was not confirmed')
  reap()
  report.update(killed=True,timedOut=reason=='timeout')
  return report
 while True:
  code=reap()
  if code is not None and not members(): break
  if time.monotonic()-started>=float(timeout):
   stop('timeout'); break
  try:
   connection,_=server.accept()
  except socket.timeout: continue
  with connection:
   connection.settimeout(2)
   request=json.loads(connection.recv(4096))
   if request.get('token')!=token:
    connection.sendall(b'{"error":"identity mismatch"}'); continue
   try: response=stop(request.get('reason'))
   except Exception as error: response={'error':str(error),'token':token}
   connection.sendall(json.dumps(response).encode())
  if report['killed']: break
 code=process.wait()
 until=time.monotonic()+0.5
 while time.monotonic()<until:
  try:
   if os.waitpid(-1,os.WNOHANG)[0]==0: time.sleep(0.01)
  except ChildProcessError: break
 # Preserve a completion receipt for an abort racing natural exit.
 temporary=root+'/done.tmp'
 with open(temporary,'w') as out: json.dump(report,out)
 os.replace(temporary,root+'/done')
 server.close()
 try: os.unlink(root+'/control')
 except FileNotFoundError: pass
 sys.exit(code if code>=0 else 128-code)
except BaseException:
 # Do not remove the receipt on normal SystemExit. The host removes it only
 # after both execution and any concurrent stop request have settled.
 raise
`;

export const stopper = String.raw`
import socket,sys,time,json,os
root,token,reason,seconds=sys.argv[1:]
end=time.monotonic()+float(seconds)
while time.monotonic()<end:
 try:
  with open(root+'/done') as source: result=json.load(source)
  if result.get('token')!=token: raise RuntimeError('Completion identity mismatch')
  print(json.dumps(result)); sys.exit(0)
 except FileNotFoundError: pass
 try:
  with socket.socket(socket.AF_UNIX) as connection:
   connection.settimeout(max(0.1,end-time.monotonic()))
   connection.connect(root+'/control')
   connection.sendall(json.dumps({'token':token,'reason':reason}).encode())
   chunks=[]
   while True:
    chunk=connection.recv(4096)
    if not chunk: break
    chunks.append(chunk)
   result=json.loads(b''.join(chunks))
   if result.get('token')!=token or result.get('error'): raise RuntimeError(str(result))
   print(json.dumps(result)); sys.exit(0)
 except (FileNotFoundError,ConnectionRefusedError,ConnectionResetError): time.sleep(0.025)
raise RuntimeError('Supervisor did not confirm termination before the deadline')
`;

async function capture(api: Api, id: string, owner: `tea-${string}` | undefined, command: string, ms: number) {
  const wait = deadline(ms);
  let stream: Awaited<ReturnType<Api['exec']>> | undefined;
  let stdout = '',
    stderr = '',
    exitCode: number | undefined;
  try {
    stream = await bounded(api.exec(id, command, owner, wait.signal), wait.signal);
    while (true) {
      const event = await bounded(stream.next(), wait.signal);
      if (event.done) break;
      if (event.value.type === 'exit') {
        exitCode = event.value.exit_code;
        break;
      }
      if (event.value.stream === 'stdout') stdout += event.value.data;
      else stderr += event.value.data;
      if (stdout.length + stderr.length > 65536) throw new Error('Control response exceeded 64 KiB');
    }
    if (exitCode !== 0) throw new Error(`Command control failed (${exitCode ?? 'no exit'}): ${stderr}`);
    return stdout;
  } finally {
    wait.dispose();
    void stream?.return(undefined).catch(() => {});
  }
}

export async function executeControlled(input: {
  api: Api;
  id: string;
  owner?: `tea-${string}`;
  script: string;
  command: string;
  args: string[];
  options: ExecuteCommandOptions;
  timeoutMs: number;
  controlMs: number;
  limit: number;
  lifetime: AbortSignal;
}): Promise<CommandResult> {
  const { api, id, owner, script, options, timeoutMs, controlMs, limit } = input;
  const signal = AbortSignal.any([input.lifetime, ...(options.abortSignal ? [options.abortSignal] : [])]);
  signal.throwIfAborted();
  const root = `/tmp/mastra-render-${randomUUID()}`;
  const token = randomUUID();
  const started = Date.now();
  const stdout = new OutputTail(limit),
    stderr = new OutputTail(limit);
  // Run cancellation controls separately from the observed stream. Do not abort
  // the stream first and then mistake its closure for successful termination.
  const transport = deadline(Math.min(2_147_483_647, timeoutMs + controlMs * 2));
  let stream: Awaited<ReturnType<Api['exec']>> | undefined;
  let stopPromise: Promise<{ token: string; killed: boolean; timedOut: boolean }> | undefined;
  let stopError: unknown;
  const stop = (reason: 'abort' | 'timeout' | 'stream') => {
    if (!stopPromise) {
      stopPromise = capture(
        api,
        id,
        owner,
        `python3 -u -c ${quote(stopper)} ${quote(root)} ${quote(token)} ${quote(reason)} ${quote(String(controlMs / 1000))}`,
        controlMs + 1000,
      ).then(raw => {
        const result = JSON.parse(raw);
        if (result.token !== token || typeof result.killed !== 'boolean' || typeof result.timedOut !== 'boolean')
          throw new Error('Invalid supervisor confirmation');
        return result;
      });
      stopPromise.catch(error => {
        stopError = error;
      });
    }
    return stopPromise;
  };
  const onAbort = () => {
    void stop('abort');
  };
  signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    void stop('timeout');
  }, timeoutMs);
  try {
    signal.throwIfAborted();
    stream = await bounded(
      api.exec(
        id,
        `python3 -u -c ${quote(supervisor)} ${quote(root)} ${quote(token)} ${quote(script)} ${quote(String(timeoutMs / 1000))}`,
        owner,
        transport.signal,
      ),
      transport.signal,
    );
    let exitCode: number | undefined;
    while (true) {
      const event = await bounded(stream.next(), transport.signal);
      if (event.done) break;
      if (event.value.type === 'exit') {
        exitCode = event.value.exit_code;
        break;
      }
      if (event.value.stream === 'stdout') {
        stdout.push(event.value.data);
        options.onStdout?.(event.value.data);
      } else {
        stderr.push(event.value.data);
        options.onStderr?.(event.value.data);
      }
    }
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
    const report = stopPromise ? await stopPromise : undefined;
    if (!Number.isInteger(exitCode)) throw new Error('No final exit event received');
    return {
      command: input.command,
      args: input.args,
      success: exitCode === 0,
      exitCode: exitCode!,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      executionTimeMs: Date.now() - started,
      killed: report?.killed ?? false,
      timedOut: report?.timedOut ?? false,
      stdoutTruncated: stdout.dropped > 0,
      stderrTruncated: stderr.dropped > 0,
      stdoutDroppedBytes: stdout.dropped,
      stderrDroppedBytes: stderr.dropped,
    };
  } catch (cause) {
    const report = await stop('stream').catch(() => undefined);
    const status = (cause as { statusCode?: number })?.statusCode;
    const code = signal.aborted
      ? 'ABORTED'
      : transport.signal.aborted
        ? 'TIMEOUT'
        : status === 401 || status === 403
          ? 'AUTHENTICATION'
          : status === 404
            ? 'NOT_FOUND'
            : 'STREAM';
    throw new RenderSandboxError(
      code,
      `Render command ${code.toLowerCase()} failure.${report ? '' : ' Remote work may still be running; termination was not confirmed.'}`,
      {
        sandboxId: id,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        stdoutDroppedBytes: stdout.dropped,
        stderrDroppedBytes: stderr.dropped,
        remoteMayBeRunning: !report,
        cleanupError: stopError,
      },
      { cause },
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
    transport.dispose();
    void stream?.return(undefined).catch(() => {});
    // A failed control request may be racing late startup. Preserve its receipt
    // and directory so a still-running supervisor can complete and be diagnosed.
    if (!stopError) await capture(api, id, owner, `rm -rf -- ${quote(root)}`, controlMs).catch(() => {});
  }
}
