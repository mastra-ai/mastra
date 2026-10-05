/**
 * Status line rendering — builds the bottom-of-screen status bar
 * showing model, mode, memory progress, and project path.
 */
import { visibleWidth } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { applyGradientSweep } from './components/obi-loader.js';
import { formatOMContextIndicator } from './components/om-progress.js';
import type { GithubPrSubscriptionBadge, TUIState } from './state.js';
import { formatStatusDuration } from './status-duration.js';
import { theme, mastra, displayModeColor, getTermWidth, extendedColors } from './theme.js';

// Colors for OM modes — read from proxy at render time so they pick up contrast adaptation
const getObserverColor = () => mastra.orange;
const getReflectorColor = () => mastra.pink;

function formatGithubPrLabel(
  state: TUIState,
  subscriptions: GithubPrSubscriptionBadge[],
): { plain: string; styled: string } {
  const label = subscriptions.length === 1 ? `PR#${subscriptions[0]!.prNumber}` : `${subscriptions.length} PRs`;
  const hasHighPriority = subscriptions.some(subscription => subscription.lastNotificationPriority === 'high');
  const color = hasHighPriority ? mastra.orange : extendedColors.skyBlue;
  if (state.githubPrPollingActive && state.githubPrGradientAnimator?.isRunning()) {
    return {
      plain: label,
      styled: applyGradientSweep(
        label,
        state.githubPrGradientAnimator.getOffset(),
        color,
        state.githubPrGradientAnimator.getFadeProgress(),
      ),
    };
  }
  return { plain: label, styled: chalk.hex(color)(label) };
}

function isGenericTitle(title: string): boolean {
  const lower = title.toLowerCase().trim();
  return (
    lower === 'new thread' ||
    lower.startsWith('new thread') ||
    lower.startsWith('clone of') ||
    lower.startsWith('untitled')
  );
}

function getGoalDurationMs(
  goal: { startedAt: string; activeStartedAt?: string; activeDurationMs?: number },
  now: number,
): number {
  const activeStartedAt = goal.activeStartedAt ?? (goal.activeDurationMs === undefined ? goal.startedAt : undefined);
  const startedMs = activeStartedAt ? Date.parse(activeStartedAt) : NaN;
  const activeRunMs = Number.isFinite(startedMs) ? Math.max(0, now - startedMs) : 0;
  return (goal.activeDurationMs ?? 0) + activeRunMs;
}

function formatGoalDuration(goal: { startedAt: string; activeStartedAt?: string; activeDurationMs?: number }): string {
  const elapsedMinutes = Math.floor(getGoalDurationMs(goal, Date.now()) / 60_000);
  if (elapsedMinutes < 1) return '<1m';

  const days = Math.floor(elapsedMinutes / 1_440);
  const hours = Math.floor((elapsedMinutes % 1_440) / 60);
  const minutes = elapsedMinutes % 60;

  if (days > 0) return hours > 0 ? `${days}days${hours}hr` : `${days}days`;
  if (hours > 0) return minutes > 0 ? `${hours}hr${minutes}m` : `${hours}hr`;
  return `${minutes}m`;
}

/** Shorten a path under the home directory to ~/… */
function shortPath(path: string): string {
  const home = process.env.HOME;
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

type Part = { plain: string; styled: string };

/**
 * Update the status line under the prompt and the Working row above it.
 *
 * Status line: one row of " · "-separated parts, left-aligned with one column of padding:
 *   mode · model · [fallback] · [goal] · [queued] · context · location
 * It never changes while the agent runs; run progress (spinner, elapsed time, throughput) lives in the
 * Working row instead. Parts are dropped or shortened from the right until the row fits.
 */
export function updateStatusLine(state: TUIState): void {
  if (!state.statusLine) return;
  const termWidth = getTermWidth();
  const PAD = 1;
  const SEP = theme.fg('dim', ' · ');
  const SEP_WIDTH = 3;
  const now = Date.now();

  // --- Mode: main mode, or judge / observe / reflect during background activity ---
  const displayState = state.session.displayState.get();
  const omStatus = displayState.omProgress.status;
  const isJudging = Boolean(state.activeGoalJudge);
  const isObserving = omStatus === 'observing';
  const isReflecting = omStatus === 'reflecting';
  const showOMMode = !isJudging && (isObserving || isReflecting);
  const modes = state.controller.listModes();
  const configuredMode = state.session.mode.resolve();
  const currentMode = modes.length > 1 ? configuredMode : undefined;
  const currentModeColor = currentMode?.metadata?.color;
  const rawModeColor = isJudging
    ? mastra.blue
    : showOMMode
      ? isObserving
        ? getObserverColor()
        : getReflectorColor()
      : typeof currentModeColor === 'string'
        ? currentModeColor
        : undefined;
  const modeColor = rawModeColor ? displayModeColor(rawModeColor) : undefined;
  const modeName = isJudging
    ? 'judge'
    : showOMMode
      ? isObserving
        ? 'observe'
        : 'reflect'
      : currentMode
        ? (currentMode.name || currentMode.id || 'unknown').toLowerCase()
        : undefined;
  // Narrow terminals: first letter only (e.g. "build" → "b", "judge" → "j").
  const modeInitial: Part | null = modeName
    ? {
        plain: modeName.charAt(0),
        styled: modeColor ? chalk.bold.hex(modeColor)(modeName.charAt(0)) : theme.fg('dim', modeName.charAt(0)),
      }
    : null;
  const modePart: Part | null = modeName
    ? { plain: modeName, styled: modeColor ? chalk.bold.hex(modeColor)(modeName) : theme.fg('dim', modeName) }
    : null;

  // --- Model: judge / OM model during background activity, otherwise the main model ---
  const rawModelId =
    (isJudging
      ? state.activeGoalJudge?.modelId
      : showOMMode
        ? isObserving
          ? state.session.om.observer.modelId()
          : state.session.om.reflector.modelId()
        : state.session.model.get()) ?? '';
  // Rewrite Fireworks AI long paths: fireworks-ai/accounts/fireworks/models/<name> → fireworks/<name>
  let fullModelId = rawModelId.startsWith('fireworks-ai/accounts/fireworks/models/')
    ? 'fireworks/' + rawModelId.slice('fireworks-ai/accounts/fireworks/models/'.length)
    : rawModelId;
  // Rewrite version separators where 'p' stands for '.': e.g. kimi-k2p6 → kimi-k2.6, minimax-m2p7 → minimax-m2.7
  fullModelId = fullModelId.replace(/\b([a-z]+-[a-z])(\d+)p(\d+)\b/g, '$1$2.$3');
  const compactModelId = (modelId: string): string => {
    const parts = modelId.split('/');
    if (parts.length >= 3) return `${parts[0]}/${parts.at(-1)!}`;
    if (parts.length === 2) return parts[1] ?? modelId;
    return modelId;
  };
  // e.g. "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4-20250514"
  // e.g. "mastra/anthropic/claude-opus-4.6" → "mastra/claude-opus-4.6"
  const shortModelId = compactModelId(fullModelId);
  // e.g. "claude-opus-4-6" → "opus 4.6"
  const tinyModelId = shortModelId.includes('/')
    ? shortModelId
    : shortModelId.replace(/^claude-/, '').replace(/^(\w+)-(\d+)-(\d{1,2})$/, '$1 $2.$3');
  const modelPart = (id: string): Part => {
    if (!state.modelAuthStatus.hasAuth) {
      const envVar = state.modelAuthStatus.apiKeyEnvVar;
      const hint = envVar ? ` (${envVar})` : ' (no key)';
      return {
        plain: `${id} ✗${hint}`,
        styled: theme.fg('dim', id) + theme.fg('error', ' ✗') + theme.fg('muted', hint),
      };
    }
    // Last run's duration stays beside the model once the run ends (the live timer is in the Working row).
    const lastRun =
      state.agentRunStartedAt === undefined && state.lastAgentRunDurationMs !== undefined
        ? formatStatusDuration(state.lastAgentRunDurationMs, { includeSeconds: true })
        : '';
    if (!lastRun) return { plain: id, styled: theme.fg('secondary', id) };
    const reason = state.lastAgentRunEndReason;
    const icon = reason === 'error' ? ' ×' : reason === 'aborted' ? '' : ' ✓';
    const tone = reason === 'error' ? 'error' : reason === 'aborted' ? 'warning' : 'success';
    return {
      plain: `${id} ${lastRun}${icon}`,
      styled: theme.fg('secondary', id) + ' ' + theme.fg(tone, lastRun + icon),
    };
  };

  // --- Transient states ---
  const fallbackPart: Part | null =
    !isJudging && !showOMMode && state.fallbackStatus
      ? (() => {
          const label = `Using fallback ${state.fallbackStatus!.usingPack} (${state.fallbackStatus!.failedPack} failed)`;
          return { plain: label, styled: theme.fg('warning', label) };
        })()
      : null;
  const goalState = state.goalManager?.getGoal();
  const goalDuration = !isJudging && goalState?.status === 'active' ? formatGoalDuration(goalState) : null;
  const goalMatchesActiveRun =
    goalState?.status === 'active' &&
    goalDuration !== null &&
    state.agentRunStartedAt !== undefined &&
    Math.floor(getGoalDurationMs(goalState, now) / 60_000) === Math.floor((now - state.agentRunStartedAt) / 60_000);
  const goalLabel = goalDuration ? (goalMatchesActiveRun ? 'goal' : `goal ${goalDuration}`) : null;
  const goalPart: Part | null = goalLabel ? { plain: goalLabel, styled: theme.fg('success', goalLabel) } : null;
  const queuedCount = state.pendingSlashCommands.length + displayState.queuedFollowUps;
  const queuedPart: Part | null =
    queuedCount > 0 ? { plain: `${queuedCount} queued`, styled: theme.fg('warning', `${queuedCount} queued`) } : null;

  // --- Context: tokens used / capacity and percentage ---
  const om = displayState.omProgress;
  const used = Math.max(0, om.pendingTokens) + Math.max(0, om.observationTokens);
  const capacity = Math.max(0, om.threshold) + Math.max(0, om.reflectionThreshold);
  const indicator = !isJudging ? formatOMContextIndicator(om, { showBar: false }) : null;
  const pct = capacity > 0 ? ` ${Math.round((used / capacity) * 100)}%` : '';
  // While observational memory buffers, the counter sweeps (messages in the mode color, memory in blue).
  const buffering = displayState.bufferingMessages || displayState.bufferingObservations;
  const sweep = buffering && state.gradientAnimator?.isRunning() ? state.gradientAnimator : undefined;
  const contextPart: Part | null = indicator
    ? {
        plain: indicator.plain.trimEnd() + pct,
        styled:
          (sweep
            ? applyGradientSweep(
                indicator.plain.trimEnd(),
                sweep.getOffset(),
                displayState.bufferingMessages ? (modeColor ?? theme.getTheme().accent) : mastra.blue,
                sweep.getFadeProgress(),
              )
            : indicator.styled.trimEnd()) + theme.fg('dim', pct),
      }
    : null;

  // --- Location: thread title, else path (branch); GitHub PR label in front ---
  const branch = state.projectInfo.gitBranch;
  const threadTitle =
    state.currentThreadTitle && !isGenericTitle(state.currentThreadTitle) ? state.currentThreadTitle : null;
  const activeGithubPrSubscriptions = state.activeGithubPrSubscriptions ?? [];
  const githubPrLabel =
    activeGithubPrSubscriptions.length > 0 ? formatGithubPrLabel(state, activeGithubPrSubscriptions) : null;
  const locationPart = (maxWidth = Infinity): Part | null => {
    const prefix = githubPrLabel ? { plain: `${githubPrLabel.plain} `, styled: `${githubPrLabel.styled} ` } : null;
    const room = maxWidth - (prefix ? visibleWidth(prefix.plain) : 0);
    let text: Part | null = null;
    // Plain-text truncation with an ellipsis; keeps at least 10 columns or gives up on the part.
    const fit = (value: string): string | null => {
      if (visibleWidth(value) <= room) return value;
      if (room < 10) return null;
      return [...value].slice(0, room - 1).join('') + '…';
    };
    if (threadTitle) {
      const title = fit(threadTitle);
      if (title) text = { plain: title, styled: theme.fg('muted', title) };
    } else {
      const path = shortPath(state.projectInfo.rootPath ?? process.cwd());
      const full = branch ? `${path} (${branch})` : path;
      if (visibleWidth(full) <= room) {
        text = { plain: full, styled: theme.fg('muted', path) + (branch ? theme.fg('dim', ` (${branch})`) : '') };
      } else {
        const short = fit(branch ?? path);
        if (short) text = { plain: short, styled: theme.fg(branch ? 'dim' : 'muted', short) };
      }
    }
    if (!text)
      return prefix && visibleWidth(prefix.plain) - 1 <= maxWidth
        ? { plain: githubPrLabel!.plain, styled: githubPrLabel!.styled }
        : null;
    return prefix ? { plain: prefix.plain + text.plain, styled: prefix.styled + text.styled } : text;
  };

  // --- Fit: try progressively more compact rows ---
  const width = (parts: Part[]) =>
    PAD + parts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP_WIDTH : 0), 0) + 1; // +1 buffer
  const compose = (parts: Array<Part | null>, withLocation: boolean): Part[] | null => {
    const present = parts.filter((p): p is Part => p !== null);
    if (!withLocation) return width(present) <= termWidth ? present : null;
    const room = termWidth - width(present) - SEP_WIDTH;
    const location = locationPart(room);
    const all = location ? [...present, location] : present;
    return location && width(all) <= termWidth ? all : null;
  };
  const transient = [fallbackPart, goalPart, queuedPart];
  const row =
    compose([modePart, modelPart(fullModelId), ...transient, contextPart], true) ??
    compose([modePart, modelPart(shortModelId), ...transient, contextPart], true) ??
    compose([modePart, modelPart(shortModelId), ...transient, contextPart], false) ??
    compose([modePart, modelPart(tinyModelId), ...transient, contextPart], false) ??
    compose([modePart, modelPart(tinyModelId), goalPart, queuedPart, contextPart], false) ??
    compose([modePart, modelPart(tinyModelId), goalPart, queuedPart], false) ??
    compose([modePart, modelPart(tinyModelId)], false) ??
    compose([modeInitial, modelPart(tinyModelId)], false) ??
    compose([modePart], false) ??
    [];
  state.statusLine.setText(' '.repeat(PAD) + row.map(p => p.styled).join(SEP));
  if (state.memoryStatusLine) state.memoryStatusLine.setText('');

  updateActivityLine(state, modeColor, now);
  state.ui.requestRender();
}

/**
 * Working row above the prompt while the agent runs: spinner, elapsed time, throughput, interrupt hint.
 * Empty (renders nothing) when idle.
 */
function updateActivityLine(state: TUIState, modeColor: string | undefined, now: number): void {
  if (!state.activityLine) return;
  if (state.agentRunStartedAt === undefined) {
    state.activityLine.setText('');
    return;
  }
  const color = modeColor ?? theme.getTheme().accent;
  const spinner = chalk.hex(color)(SPINNER[Math.floor(now / 80) % SPINNER.length]!);
  const elapsed = formatStatusDuration(now - state.agentRunStartedAt, { includeSeconds: true });
  const stale =
    state.agentRunLastStreamPartAt !== undefined && now - state.agentRunLastStreamPartAt > 3 * 60_000
      ? formatStatusDuration(now - state.agentRunLastStreamPartAt, { includeSeconds: false })
      : null;
  const parts = [theme.fg(stale ? 'error' : 'dim', elapsed)];
  if (stale) parts.push(theme.fg('warning', `no output for ${stale}`));
  if (state.tokensPerSec > 0) parts.push(theme.fg('dim', `${state.tokensPerSec} tok/s`));
  parts.push(`${theme.fg('muted', 'esc')}${theme.fg('dim', ' to interrupt')}`);
  state.activityLine.setText(
    ` ${spinner} ${theme.bold(theme.fg('secondary', 'Working'))} ${parts.join(theme.fg('dim', ' · '))}`,
  );
}
