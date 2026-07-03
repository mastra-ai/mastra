import type { PlanResume } from '@mastra/client-js';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { useCallback, useState } from 'react';

import { useApiConfig } from '../../shared/api/config';
import { AppLayout } from './AppLayout';
import { redirectToLogout, useWebAuth } from './domains/auth';
import type { SlashCommand } from './domains/chat';
import { SLASH_COMMANDS, useAgentControllerSession, useGlobalShortcuts, useTranscriptScroll } from './domains/chat';
import { useDensityPreference } from './domains/settings';
import {
  deriveProjectPath,
  useProjectModalAutoOpen,
  useProjectSessionSync,
  useActiveProject,
} from './domains/workspaces';
import { useToast } from './ui';

export default function Chat() {
  const { toast } = useToast();
  const { baseUrl } = useApiConfig();
  const webAuth = useWebAuth();
  const { projects, activeProject, activeProjectId, resourceId, sessionEnabled, selectProject } = useActiveProject();

  const session = useAgentControllerSession({
    agentControllerId: 'code',
    resourceId,
    projectPath: deriveProjectPath(activeProject),
    baseUrl,
    enabled: sessionEnabled,
  });
  const { transcript, status, modes, threads, approveTool, respondSuspension } = session;

  const onApprove = useCallback(
    (toolCallId: string, approved: boolean, id: string) => void approveTool(toolCallId, approved, id),
    [approveTool],
  );
  const onRespond = useCallback(
    (toolCallId: string, data: string | string[] | PlanResume, id: string) =>
      void respondSuspension(toolCallId, data, id),
    [respondSuspension],
  );

  const { threadRef, showScrollDown, scrollToBottom } = useTranscriptScroll(transcript);
  useProjectSessionSync({ session, status, resourceId, activeProject });

  const busy = transcript.running || transcript.pending;
  const lastEntry = transcript.entries[transcript.entries.length - 1];
  const lastEntryHasText =
    lastEntry?.kind === 'message' &&
    lastEntry.message.role === 'assistant' &&
    lastEntry.message.content.parts.some(part => part.type === 'text' && part.text.trim().length > 0);
  const showWorkingIndicator =
    busy &&
    !(
      lastEntry?.kind === 'message' &&
      lastEntry.message.role === 'assistant' &&
      lastEntry.streaming &&
      lastEntryHasText
    );

  const { theme, setTheme } = useTheme();
  const { density, changeDensity } = useDensityPreference();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [composerCommandName, setComposerCommandName] = useState<string | null>(null);

  const onSignOut = useCallback(() => redirectToLogout(baseUrl), [baseUrl]);
  const auth = {
    state: webAuth.data,
    loading: webAuth.isLoading,
    onSignOut,
  };

  useProjectModalAutoOpen(projects.length, setProjectsOpen);
  useGlobalShortcuts({
    busy,
    projectsOpen,
    settingsOpen,
    shortcutsOpen,
    paletteOpen,
    sidebarOpen,
    setPaletteOpen,
    setShortcutsOpen,
    setSettingsOpen,
    setSidebarOpen,
    abort: session.abort,
  });

  const runPaletteCommand = (command: SlashCommand) => {
    if (command.args) {
      setComposerCommandName(command.name);
    } else {
      void runNoArgCommand(command.name);
    }
  };

  async function runNoArgCommand(name: string) {
    switch (name) {
      case 'goal-clear':
        await session.clearGoal();
        return;
      case 'goal-pause':
        await session.pauseGoal();
        return;
      case 'goal-resume':
        await session.resumeGoal();
        return;
      case 'permissions': {
        const rules = await session.getPermissions();
        const cats =
          Object.entries(rules.categories ?? {})
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n') || '  (none)';
        const tools =
          Object.entries(rules.tools ?? {})
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n') || '  (none)';
        session.pushNotice(`Categories:\n${cats}\nTools:\n${tools}`);
        return;
      }
      case 'yolo':
        for (const cat of ['read', 'edit', 'execute', 'mcp', 'other'] as const) {
          await session.setPermissionForCategory(cat, 'allow');
        }
        session.pushNotice('YOLO mode: all tool categories set to auto-allow');
        return;
      case 'cost': {
        const u = transcript.usage;
        session.pushNotice(
          !u?.totalTokens
            ? 'No token usage recorded yet.'
            : `Tokens — prompt: ${u.promptTokens ?? 0}, completion: ${u.completionTokens ?? 0}, total: ${u.totalTokens}`,
        );
        return;
      }
      case 'think':
        session.pushNotice(
          'Extended thinking: steer the agent with "think step by step" or switch to a thinking-capable model.',
        );
        return;
      case 'om':
        session.pushNotice(`Observational memory phase: ${transcript.omPhase ?? 'idle'}`);
        return;
      case 'settings':
        session.pushNotice(
          [
            `Project: ${activeProject?.name ?? '(none)'}`,
            `Path: ${activeProject?.path ?? '(default workspace)'}`,
            `Mode: ${transcript.modeId ?? '—'}`,
            `Model: ${transcript.modelId ?? '—'}`,
            `Thread: ${transcript.threadId ?? '—'}`,
            `Running: ${transcript.running}`,
          ].join('\n'),
        );
        return;
      case 'abort':
        await session.abort();
        return;
      case 'help': {
        const width = Math.max(...SLASH_COMMANDS.map(c => `/${c.name} ${c.args ?? ''}`.length));
        const lines = SLASH_COMMANDS.map(c => {
          const sig = `/${c.name} ${c.args ?? ''}`.padEnd(width);
          return `  ${sig}  — ${c.description}`;
        });
        session.pushNotice(['Available commands:', ...lines].join('\n'));
        return;
      }
      default:
        session.pushNotice(`Command /${name} needs arguments. Type it in the composer.`, 'error');
    }
  }

  return (
    <AppLayout
      activeProject={activeProject}
      activeProjectId={activeProjectId}
      projects={projects}
      auth={auth}
      threads={threads}
      transcript={transcript}
      status={status}
      modes={modes}
      session={session}
      busy={busy}
      showWorkingIndicator={showWorkingIndicator}
      threadRef={threadRef}
      showScrollDown={showScrollDown}
      scrollToBottom={scrollToBottom}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      closeSidebar={closeSidebar}
      projectsOpen={projectsOpen}
      setProjectsOpen={setProjectsOpen}
      settingsOpen={settingsOpen}
      setSettingsOpen={setSettingsOpen}
      shortcutsOpen={shortcutsOpen}
      setShortcutsOpen={setShortcutsOpen}
      paletteOpen={paletteOpen}
      setPaletteOpen={setPaletteOpen}
      theme={theme}
      density={density}
      resourceId={resourceId}
      sessionEnabled={sessionEnabled}
      selectProject={selectProject}
      changeDensity={changeDensity}
      setTheme={setTheme}
      toast={toast}
      onApprove={onApprove}
      onRespond={onRespond}
      composerCommandName={composerCommandName}
      onComposerCommandApplied={() => setComposerCommandName(null)}
      runPaletteCommand={runPaletteCommand}
    />
  );
}
