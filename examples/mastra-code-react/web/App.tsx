import { useEffect, useRef, useState } from 'react';

import { StatusLine, Transcript } from './components';
import { useHarnessSession } from './useHarnessSession';

// A fixed conversation id for this demo. In a real app this is the signed-in
// user id (or a per-conversation id); the server get-or-creates a durable
// session for it, so reloads resume the same thread.
const RESOURCE_ID = 'web-demo-user';

export default function App() {
  const session = useHarnessSession({ harnessId: 'code', resourceId: RESOURCE_ID });
  const { transcript, status, modes, threads, send, steer, abort } = session;
  const [draft, setDraft] = useState('');
  const [showThreads, setShowThreads] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the transcript as it grows.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [transcript.entries.length, transcript.running]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void handleInput(text);
  };

  async function handleInput(text: string) {
    // Slash commands mirror a subset of MastraCode's command surface.
    if (text.startsWith('/')) {
      const [cmd, ...rest] = text.slice(1).split(/\s+/);
      const arg = rest.join(' ');
      switch (cmd) {
        case 'mode':
          if (arg) await session.switchMode(arg);
          return;
        case 'model':
          if (arg) await session.switchModel(arg);
          return;
        case 'threads':
          await session.refreshThreads();
          setShowThreads(true);
          return;
        default:
          return;
      }
    }
    // While the agent runs, additional input steers the active turn.
    if (transcript.running) await steer(text);
    else await send(text);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <strong>MastraCode</strong>
        <div style={styles.modes}>
          {modes.map(m => (
            <button
              key={m.id}
              style={{ ...styles.modeBtn, ...(transcript.modeId === m.id ? styles.modeActive : {}) }}
              onClick={() => void session.switchMode(m.id)}
            >
              {m.name ?? m.id}
            </button>
          ))}
          <button style={styles.modeBtn} onClick={() => { void session.refreshThreads(); setShowThreads(s => !s); }}>
            threads
          </button>
        </div>
      </header>

      {showThreads && (
        <div style={styles.threadBar}>
          {threads.length === 0 && <span style={styles.dim}>No other threads</span>}
          {threads.map(t => (
            <button
              key={t.id}
              style={{ ...styles.threadBtn, ...(transcript.threadId === t.id ? styles.modeActive : {}) }}
              onClick={() => { void session.switchThread(t.id); setShowThreads(false); }}
            >
              {t.title ?? t.id.slice(0, 8)}
            </button>
          ))}
        </div>
      )}

      <main ref={threadRef} style={styles.thread}>
        {transcript.entries.length === 0 && (
          <p style={styles.empty}>Ask the coding agent to read, write, or run something in the workspace.</p>
        )}
        <Transcript entries={transcript.entries} onApprove={session.approveTool} onRespond={session.respondSuspension} />
      </main>

      <form onSubmit={onSubmit} style={styles.composer}>
        <input
          style={styles.input}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={transcript.running ? 'Steer the run, or /command…' : 'Message the agent, or /mode plan…'}
          disabled={status !== 'ready'}
        />
        {transcript.running ? (
          <button type="button" style={styles.stop} onClick={() => void abort()}>
            Stop
          </button>
        ) : (
          <button type="submit" style={styles.sendBtn} disabled={status !== 'ready' || !draft.trim()}>
            Send
          </button>
        )}
      </form>

      <StatusLine status={status} modeId={transcript.modeId} modelId={transcript.modelId} running={transcript.running} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 820, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' },
  modes: { display: 'flex', gap: 6 },
  modeBtn: { padding: '4px 10px', borderRadius: 999, border: '1px solid #d1d5db', background: 'white', fontSize: 12, cursor: 'pointer' },
  modeActive: { background: '#111827', color: 'white', borderColor: '#111827' },
  threadBar: { display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa' },
  threadBtn: { padding: '4px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', fontSize: 12, cursor: 'pointer' },
  thread: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  dim: { color: '#9ca3af', fontSize: 12 },
  composer: { display: 'flex', gap: 8, padding: 16, borderTop: '1px solid #e5e7eb' },
  input: { flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 },
  sendBtn: { padding: '10px 18px', borderRadius: 8, border: 'none', background: '#111827', color: 'white', fontSize: 14, cursor: 'pointer' },
  stop: { padding: '10px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', fontSize: 14, cursor: 'pointer' },
};
