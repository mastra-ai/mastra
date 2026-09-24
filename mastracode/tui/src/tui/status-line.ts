/**
 * Status line rendering — builds the bottom-of-screen status bar
 * showing model, mode, memory progress, and project path.
 */
import { visibleWidth } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { applyGradientSweep } from './components/obi-loader.js';
import { formatOMContextIndicator } from './components/om-progress.js';
import { getEffectiveOMRoleModelId } from './om-model.js';
import type { GithubPrSubscriptionBadge, TUIState } from './state.js';
import { formatStatusDuration } from './status-duration.js';
import { theme, mastra, displayModeColor, extendedColors, getContrastBg } from './theme.js';

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
  return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path;
}

/**
 * The path, then shorter forms that keep the last directories, like zsh's prompt truncation:
 * ~/dev/mastra/mastracode/tui → ~/…/mastracode/tui → ~/…/tui
 */
function compactPaths(path: string): string[] {
  const isHome = path.startsWith('~/');
  const isAbsolute = path.startsWith('/');
  const segments = (isHome ? path.slice(2) : isAbsolute ? path.slice(1) : path).split('/').filter(Boolean);
  const prefix = isHome ? '~/…/' : isAbsolute ? '/…/' : '…/';
  const paths = [path];
  for (const keep of [2, 1]) {
    if (segments.length > keep) paths.push(prefix + segments.slice(-keep).join('/'));
  }
  return paths;
}

function truncateEnd(value: string, maxWidth: number): string {
  return [...value].slice(0, Math.max(0, maxWidth - 1)).join('') + '…';
}

/** ~/…/a-very-long-directory-name → ~/…/a-very-l…ry-name */
function truncateLastSegment(path: string, maxWidth: number): string {
  if (visibleWidth(path) <= maxWidth) return path;
  const slash = path.lastIndexOf('/');
  const head = path.slice(0, slash + 1);
  const name = [...path.slice(slash + 1)];
  const room = maxWidth - visibleWidth(head) - 1;
  if (room < 2) return truncateEnd(path, maxWidth);
  const start = Math.ceil(room * 0.6);
  return head + name.slice(0, start).join('') + '…' + name.slice(name.length - (room - start)).join('');
}

// A small dot that pulses (fades into the background and back) rather than a braille spinner, so it
// reads differently from the spinner on shell tools.
const PULSE_PERIOD_MS = 1600;
/** How far the dot fades at its dimmest: 0 = no fade, 1 = disappears into the background. */
const PULSE_DEPTH = 1;

/** Terminal width at which the footer last needed two rows (see updateStatusLine). */
const twoRowFooterWidth = new WeakMap<TUIState, number>();

function pulseDot(color: string, now: number): string {
  const wave = (Math.cos((now / PULSE_PERIOD_MS) * Math.PI * 2) + 1) / 2; // 1 = full color, 0 = dimmest
  const fade = PULSE_DEPTH * (1 - wave);
  const bg = getContrastBg();
  const channel = (i: number) => {
    const fg = parseInt(color.slice(i, i + 2), 16);
    return Math.round(fg + (parseInt(bg.slice(i, i + 2), 16) - fg) * fade);
  };
  return chalk.rgb(channel(1), channel(3), channel(5))('•');
}

type Part = { plain: string; styled: string };

/**
 * Update the status line under the prompt and the Working row above it.
 *
 * Status line: " · "-separated parts, left-aligned with one column of padding:
 *   mode · model · [fallback] · [goal] · [queued] · context · location
 * A long path shortens like zsh (~/…/parent/dir) to stay on one row; only when even that doesn't fit does
 * the location move to a second row.
 * It never changes while the agent runs; run progress (spinner, elapsed time, throughput) lives in the
 * Working row instead. Parts are dropped or shortened from the right until the first row fits.
 */
export function updateStatusLine(state: TUIState): void {
  if (!state.statusLine) return;
  // The real width, not getTermWidth()'s 40-column floor: the row has to fit or it wraps.
  const termWidth = state.ui.terminal?.columns || process.stdout.columns || 80;
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
          ? getEffectiveOMRoleModelId(state.session, 'observer')
          : getEffectiveOMRoleModelId(state.session, 'reflector')
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
  // 'full': the whole path; 'compact': also ~/…/parent/dir forms; 'any': also cut the title / branch / last directory.
  type Fit = 'full' | 'compact' | 'any';
  const locationPart = (maxWidth: number, fit: Fit): Part | null => {
    const prefix = githubPrLabel ? { plain: `${githubPrLabel.plain} `, styled: `${githubPrLabel.styled} ` } : null;
    const room = maxWidth - (prefix ? visibleWidth(prefix.plain) : 0);
    const fits = (value: string) => visibleWidth(value) <= room;
    let text: Part | null = null;
    if (threadTitle) {
      const title = fits(threadTitle)
        ? threadTitle
        : fit === 'any' && room >= 10
          ? truncateEnd(threadTitle, room)
          : null;
      if (title) text = { plain: title, styled: theme.fg('muted', title) };
    } else {
      const withBranch = (path: string): Part => ({
        plain: branch ? `${path} (${branch})` : path,
        styled: theme.fg('muted', path) + (branch ? theme.fg('dim', ` (${branch})`) : ''),
      });
      const path = shortPath(state.projectInfo.rootPath ?? process.cwd());
      const candidates = fit === 'full' ? [withBranch(path)] : compactPaths(path).map(withBranch);
      text = candidates.find(candidate => fits(candidate.plain)) ?? null;
      if (!text && fit === 'any' && room >= 10) {
        // Out of room for the path: keep the branch alone, or the last directory cut in the middle.
        const value = branch
          ? fits(branch)
            ? branch
            : truncateEnd(branch, room)
          : truncateLastSegment(compactPaths(path).at(-1)!, room);
        text = { plain: value, styled: theme.fg(branch ? 'dim' : 'muted', value) };
      }
    }
    if (!text)
      return prefix && visibleWidth(prefix.plain) - 1 <= maxWidth
        ? { plain: githubPrLabel!.plain, styled: githubPrLabel!.styled }
        : null;
    return prefix ? { plain: prefix.plain + text.plain, styled: prefix.styled + text.styled } : text;
  };

  // --- Fit: one row when everything fits, else the location moves to a second row ---
  const width = (parts: Part[]) =>
    PAD + parts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP_WIDTH : 0), 0) + 1; // +1 buffer
  const fitsRow = (parts: Array<Part | null>): Part[] | null => {
    const present = parts.filter((p): p is Part => p !== null);
    return width(present) <= termWidth ? present : null;
  };
  const withLocation = (parts: Array<Part | null>, fit: Fit): Part[] | null => {
    const present = parts.filter((p): p is Part => p !== null);
    const location = locationPart(termWidth - width(present) - SEP_WIDTH, fit);
    return location ? fitsRow([...present, location]) : null;
  };
  const transient = [fallbackPart, goalPart, queuedPart];
  // Once the footer has needed two rows at this width, keep the location on the second row
  // even when it would fit on one again. Dropping back to one row shrinks the UI, which leaves a blank
  // line at the bottom of the terminal until new output pushes the prompt back down.
  const stickyTwoRows = twoRowFooterWidth.get(state) === termWidth;
  const oneRow = stickyTwoRows
    ? null
    : (withLocation([modePart, modelPart(fullModelId), ...transient, contextPart], 'full') ??
      withLocation([modePart, modelPart(shortModelId), ...transient, contextPart], 'full') ??
      withLocation([modePart, modelPart(fullModelId), ...transient, contextPart], 'compact') ??
      withLocation([modePart, modelPart(shortModelId), ...transient, contextPart], 'compact'));
  const row =
    oneRow ??
    fitsRow([modePart, modelPart(fullModelId), ...transient, contextPart]) ??
    fitsRow([modePart, modelPart(shortModelId), ...transient, contextPart]) ??
    fitsRow([modePart, modelPart(tinyModelId), ...transient, contextPart]) ??
    fitsRow([modePart, modelPart(tinyModelId), goalPart, queuedPart, contextPart]) ??
    fitsRow([modePart, modelPart(tinyModelId), goalPart, queuedPart]) ??
    fitsRow([modePart, modelPart(tinyModelId)]) ??
    fitsRow([modeInitial, modelPart(tinyModelId)]) ??
    fitsRow([modePart]) ??
    [];
  const secondRow = oneRow ? null : locationPart(termWidth - PAD - 1, 'any');
  if (secondRow) twoRowFooterWidth.set(state, termWidth);
  else twoRowFooterWidth.delete(state);
  state.statusLine.setText(' '.repeat(PAD) + row.map(p => p.styled).join(SEP));
  if (state.memoryStatusLine) state.memoryStatusLine.setText(secondRow ? ' '.repeat(PAD) + secondRow.styled : '');

  updateActivityLine(state, modeColor, now);
  state.ui.requestRender();
}

/**
 * Working row above the prompt while the agent runs: spinner, elapsed time, throughput, interrupt hint.
 * Empty (renders nothing) when idle.
 */
function updateActivityLine(state: TUIState, modeColor: string | undefined, now: number): void {
  if (!state.idleCounter) return;
  if (state.agentRunStartedAt === undefined) {
    state.idleCounter.setActivity('');
    return;
  }
  const color = modeColor ?? theme.getTheme().accent;
  const spinner = pulseDot(color, now);
  const elapsed = formatStatusDuration(now - state.agentRunStartedAt, { includeSeconds: true });
  const stale =
    state.agentRunLastStreamPartAt !== undefined && now - state.agentRunLastStreamPartAt > 3 * 60_000
      ? formatStatusDuration(now - state.agentRunLastStreamPartAt, { includeSeconds: false })
      : null;
  const parts = [theme.fg(stale ? 'error' : 'dim', elapsed)];
  if (stale) parts.push(theme.fg('warning', `no output for ${stale}`));
  if (state.tokensPerSec > 0) parts.push(theme.fg('dim', `${state.tokensPerSec} tok/s`));
  parts.push(`${theme.fg('muted', 'esc')}${theme.fg('dim', ' to interrupt')}`);
  // The label reads "thinking" while quiet mode hides reasoning; "working" gets a trailing space so the
  // details after it don't shift by a column when the label swaps.
  const label = state.idleCounter.isThinking() ? 'thinking' : 'working ';
  state.idleCounter.setActivity(
    ` ${spinner} ${theme.bold(theme.fg('secondary', label))} ${parts.join(theme.fg('dim', ' · '))}`,
  );
}
