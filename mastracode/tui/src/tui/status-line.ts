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
import { theme, mastra, mastraBrand, tintHex, getTermWidth, extendedColors } from './theme.js';

// Colors for OM modes — read from proxy at render time so they pick up contrast adaptation
const getObserverColor = () => mastra.orange;
const getReflectorColor = () => mastra.pink;

function formatGithubPrLabel(
  state: TUIState,
  subscription: GithubPrSubscriptionBadge,
): { plain: string; styled: string } {
  const label = `PR#${subscription.prNumber}`;
  const color = subscription.lastNotificationPriority === 'high' ? mastra.orange : extendedColors.skyBlue;
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

/**
 * Update the status line at the bottom of the TUI.
 * Progressively reduces content to fit the terminal width.
 */
export function updateStatusLine(state: TUIState): void {
  if (!state.statusLine) return;
  const termWidth = getTermWidth();
  const SEP = '  '; // double-space separator between parts

  // --- Determine if we're showing observer/reflector instead of main mode ---
  const displayState = state.session.displayState.get();
  const omStatus = displayState.omProgress.status;
  const isJudging = Boolean(state.activeGoalJudge);
  const isObserving = omStatus === 'observing';
  const isReflecting = omStatus === 'reflecting';
  const showOMMode = !isJudging && (isObserving || isReflecting);

  // --- Mode badge ---
  let modeBadge = '';
  let modeBadgeWidth = 0;
  const modes = state.controller.listModes();
  const configuredMode = state.session.mode.resolve();
  const currentMode = modes.length > 1 ? configuredMode : undefined;
  const judgeModeColor = mastra.blue;
  // Use judge color for goal judge activity, OM color for OM activity, otherwise mode color
  const currentModeColor = currentMode?.metadata?.color;
  const mainModeColor = typeof currentModeColor === 'string' ? currentModeColor : undefined;
  const configuredModeColor = configuredMode?.metadata?.color;
  const contextIndicatorColor = typeof configuredModeColor === 'string' ? configuredModeColor : mastra.green;
  const modeColor = isJudging
    ? judgeModeColor
    : showOMMode
      ? isObserving
        ? getObserverColor()
        : getReflectorColor()
      : mainModeColor;
  // Tinted near-black background from mode color (shared between badge and model ID)
  const tintBg = modeColor ? tintHex(modeColor, 0.15) : undefined;
  // Badge name: use judge/OM mode name for background activity, otherwise main mode name
  const badgeName = isJudging
    ? 'judge'
    : showOMMode
      ? isObserving
        ? 'observe'
        : 'reflect'
      : currentMode
        ? currentMode.name || currentMode.id || 'unknown'
        : undefined;
  if (badgeName && modeColor) {
    const [mcr, mcg, mcb] = [
      parseInt(modeColor.slice(1, 3), 16),
      parseInt(modeColor.slice(3, 5), 16),
      parseInt(modeColor.slice(5, 7), 16),
    ];
    // Pulse the badge bg brightness opposite to the gradient sweep
    let badgeBrightness = 0.9;
    if (state.gradientAnimator?.isRunning()) {
      const fade = state.gradientAnimator.getFadeProgress();
      const easedFade = fade * fade * (3 - 2 * fade); // smoothstep
      const offset = state.gradientAnimator.getOffset() % 1;
      // Inverted phase (+ PI), range 0.65-0.95
      const animBrightness = 0.65 + 0.3 * (0.5 + 0.5 * Math.sin(offset * Math.PI * 2 + Math.PI));
      // Interpolate toward idle (0.9) as fade progresses
      badgeBrightness = animBrightness + (0.9 - animBrightness) * easedFade;
    }
    const mr = Math.floor(mcr * badgeBrightness);
    const mg = Math.floor(mcg * badgeBrightness);
    const mb = Math.floor(mcb * badgeBrightness);
    const rightHalf = tintBg ? chalk.rgb(mr, mg, mb).bgHex(tintBg)('▌') : chalk.rgb(mr, mg, mb)('▌');
    modeBadge =
      chalk.rgb(mr, mg, mb)('▐') + chalk.bgRgb(mr, mg, mb).hex('#000000').bold(badgeName.toLowerCase()) + rightHalf;
    modeBadgeWidth = badgeName.length + 2;
  } else if (badgeName) {
    modeBadge = ' ' + theme.fg('dim', badgeName) + ' ';
    modeBadgeWidth = badgeName.length + 2;
  }

  // --- Collect raw data ---
  // Show judge/OM model during background activity, otherwise main model
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
    if (parts.length >= 3) {
      return `${parts[0]}/${parts.at(-1)!}`;
    }
    if (parts.length === 2) {
      return parts[1] ?? modelId;
    }
    return modelId;
  };

  // e.g. "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4-20250514"
  // e.g. "mastra/anthropic/claude-opus-4.6" → "mastra/claude-opus-4.6"
  const shortModelId = compactModelId(fullModelId);
  // e.g. "claude-opus-4-6" → "opus 4.6", "mastra/anthropic/claude-opus-4.6" → "mastra/claude-opus-4.6"
  const tinyModelId = shortModelId.includes('/')
    ? shortModelId
    : shortModelId.replace(/^claude-/, '').replace(/^(\w+)-(\d+)-(\d{1,2})$/, '$1 $2.$3');

  const branch = state.projectInfo.gitBranch;
  const threadTitle =
    state.currentThreadTitle && !isGenericTitle(state.currentThreadTitle) ? state.currentThreadTitle : null;
  const activeGithubPr = state.activeGithubPrSubscriptions[0];
  const githubPrLabel = activeGithubPr ? formatGithubPrLabel(state, activeGithubPr) : null;
  const centerText = threadTitle || branch || (githubPrLabel ? '' : null);
  const centerTextShort =
    centerText && centerText.length > 24 ? centerText.slice(0, 12) + '..' + centerText.slice(-8) : centerText;
  const now = Date.now();
  const queuedCount = state.pendingQueuedActions.length + state.session.followUps.count();
  const queuedLabel = queuedCount > 0 ? `${queuedCount} queued` : null;
  const goalState = state.goalManager?.getGoal();
  const goalDuration = !isJudging && goalState?.status === 'active' ? formatGoalDuration(goalState) : null;
  const goalMatchesActiveRun =
    goalState?.status === 'active' &&
    goalDuration !== null &&
    state.agentRunStartedAt !== undefined &&
    Math.floor(getGoalDurationMs(goalState, now) / 60_000) === Math.floor((now - state.agentRunStartedAt) / 60_000);
  const goalLabel = goalDuration ? (goalMatchesActiveRun ? 'goal' : `goal ${goalDuration}`) : null;
  const formatDirPart = (value: string) => {
    const separator = githubPrLabel && value ? ' ' : '';
    return {
      plain: githubPrLabel ? `${githubPrLabel.plain}${separator}${value}` : value,
      styled: githubPrLabel
        ? `${githubPrLabel.styled}${separator}${theme.fg('thinkingText', value)}`
        : theme.fg('thinkingText', value),
    };
  };

  // --- Helper to style the model ID ---
  const modelTrail = tintBg ? chalk.hex(tintBg)('▌') : '';
  const styleModelId = (id: string): string => {
    if (!state.modelAuthStatus.hasAuth) {
      const envVar = state.modelAuthStatus.apiKeyEnvVar;
      return theme.fg('dim', id) + theme.fg('error', ' ✗') + theme.fg('muted', envVar ? ` (${envVar})` : ' (no key)');
    }

    if (state.gradientAnimator?.isRunning() && modeColor) {
      const fade = state.gradientAnimator.getFadeProgress();
      const easedFade = fade * fade * (3 - 2 * fade); // smoothstep
      const text = applyGradientSweep(id, state.gradientAnimator.getOffset(), modeColor, easedFade);
      const styled = chalk.italic(text);
      const bg = tintBg ? chalk.bgHex(tintBg)(styled) : styled;
      return bg + modelTrail;
    }
    if (modeColor) {
      // Use same idle brightness as gradient animation convergence (0.8)
      // so there's no color jump when animation stops
      const [cr, cg, cb] = [
        parseInt(modeColor.slice(1, 3), 16),
        parseInt(modeColor.slice(3, 5), 16),
        parseInt(modeColor.slice(5, 7), 16),
      ];
      const idleBright = 0.8;
      const fgStyled = chalk
        .rgb(Math.floor(cr * idleBright), Math.floor(cg * idleBright), Math.floor(cb * idleBright))
        .bold.italic(id);
      const bg = tintBg ? chalk.bgHex(tintBg)(fgStyled) : fgStyled;
      return bg + modelTrail;
    }
    return chalk.hex(mastra.specialGray).bold.italic(id);
  };

  // --- Build line with progressive reduction ---
  // Strategy: progressively drop less-important elements to fit terminal width.
  // Each attempt assembles plain-text parts, measures, and if it fits, styles and renders.

  // Short badge: first letter only (e.g., "build" → "b", "observe" → "o")
  let shortModeBadge = '';
  let shortModeBadgeWidth = 0;
  if (badgeName && modeColor) {
    const shortName = badgeName.toLowerCase().charAt(0);
    const [mcr, mcg, mcb] = [
      parseInt(modeColor.slice(1, 3), 16),
      parseInt(modeColor.slice(3, 5), 16),
      parseInt(modeColor.slice(5, 7), 16),
    ];
    let sBadgeBrightness = 0.9;
    if (state.gradientAnimator?.isRunning()) {
      const fade = state.gradientAnimator.getFadeProgress();
      if (fade < 1) {
        const offset = state.gradientAnimator.getOffset() % 1;
        const animBrightness = 0.65 + 0.3 * (0.5 + 0.5 * Math.sin(offset * Math.PI * 2 + Math.PI));
        sBadgeBrightness = animBrightness + (0.9 - animBrightness) * fade;
      }
    }
    const sr = Math.floor(mcr * sBadgeBrightness);
    const sg = Math.floor(mcg * sBadgeBrightness);
    const sb = Math.floor(mcb * sBadgeBrightness);
    const shortRightHalf = tintBg ? chalk.rgb(sr, sg, sb).bgHex(tintBg)('▌') : chalk.rgb(sr, sg, sb)('▌');
    shortModeBadge =
      chalk.rgb(sr, sg, sb)('▐') + chalk.bgRgb(sr, sg, sb).hex('#000000').bold(shortName) + shortRightHalf;
    shortModeBadgeWidth = shortName.length + 2;
  } else if (badgeName) {
    const shortName = badgeName.toLowerCase().charAt(0);
    shortModeBadge = ' ' + theme.fg('dim', shortName) + ' ';
    shortModeBadgeWidth = shortName.length + 2;
  }

  const activeTimingLabel =
    state.agentRunStartedAt !== undefined
      ? formatStatusDuration(now - state.agentRunStartedAt, { includeSeconds: true })
      : '';
  const activeTimingIsStale =
    state.agentRunStartedAt !== undefined &&
    state.agentRunLastStreamPartAt !== undefined &&
    now - state.agentRunLastStreamPartAt > 3 * 60_000;
  const completedTimingLabel =
    !activeTimingLabel && state.lastAgentRunDurationMs !== undefined
      ? formatStatusDuration(state.lastAgentRunDurationMs, { includeSeconds: true })
      : '';
  const completedTimingIcon =
    state.lastAgentRunEndReason === 'error'
      ? '×'
      : completedTimingLabel && state.lastAgentRunEndReason !== 'aborted'
        ? '✓'
        : '';
  const timingLabel = activeTimingLabel || completedTimingLabel;

  const buildLine = (opts: {
    modelId: string;
    showOM?: boolean;
    showOMBar?: boolean;
    showDir: boolean;
    dir?: string | null;
    allowDirTruncation?: boolean;
    badge?: 'full' | 'short';
    showQueue?: boolean;
  }): { plain: string; styled: string } | null => {
    const parts: Array<{ plain: string; styled: string }> = [];
    // Model ID (always present) — styleModelId adds padding spaces
    const timingPlain = timingLabel ? ` ${timingLabel}${completedTimingIcon ? ` ${completedTimingIcon}` : ''}` : '';
    const timingColor = activeTimingIsStale
      ? theme.fg('error', timingLabel)
      : activeTimingLabel
        ? modeColor
          ? chalk.hex(modeColor)(timingLabel)
          : theme.fg('dim', timingLabel)
        : state.lastAgentRunEndReason === 'aborted'
          ? theme.fg('warning', timingLabel)
          : state.lastAgentRunEndReason === 'error'
            ? theme.fg('error', timingLabel)
            : theme.fg('success', timingLabel);
    const timingIconColor =
      state.lastAgentRunEndReason === 'aborted'
        ? 'warning'
        : state.lastAgentRunEndReason === 'error'
          ? 'error'
          : 'success';
    const timingStyled = timingLabel
      ? ` ${timingColor}${completedTimingIcon ? ` ${theme.fg(timingIconColor, completedTimingIcon)}` : ''}`
      : '';
    parts.push({
      plain: `${opts.modelId}${tintBg ? ' ' : ''}${timingPlain}`,
      styled: styleModelId(opts.modelId) + timingStyled,
    });
    const useBadge = opts.badge === 'short' ? shortModeBadge : modeBadge;
    const useBadgeWidth = opts.badge === 'short' ? shortModeBadgeWidth : modeBadgeWidth;
    const ds = displayState;
    const messageColor = contextIndicatorColor;
    const memoryColor = mastraBrand.blue;
    const unusedColor = '#3f3f46';
    const messageSegmentStyler =
      ds.bufferingMessages && state.gradientAnimator?.isRunning()
        ? (segment: string) =>
            applyGradientSweep(
              segment,
              state.gradientAnimator!.getOffset(),
              messageColor,
              state.gradientAnimator!.getFadeProgress(),
            )
        : (segment: string) => chalk.hex(messageColor)(segment);
    const memorySegmentStyler =
      ds.bufferingObservations && state.gradientAnimator?.isRunning()
        ? (segment: string) =>
            applyGradientSweep(
              segment,
              state.gradientAnimator!.getOffset(),
              memoryColor,
              state.gradientAnimator!.getFadeProgress(),
            )
        : (segment: string) => chalk.hex(memoryColor)(segment);
    const unusedSegmentStyler = (segment: string) => chalk.hex(unusedColor)(segment);
    const indicatorPart =
      !isJudging && opts.showOM !== false
        ? formatOMContextIndicator(ds.omProgress, {
            messages: messageSegmentStyler,
            memory: memorySegmentStyler,
            unused: unusedSegmentStyler,
            showBar: opts.showOMBar,
          })
        : null;
    if (opts.showQueue && goalLabel) {
      parts.push({
        plain: goalLabel,
        styled: theme.fg('success', goalLabel),
      });
    }
    if (opts.showQueue && queuedLabel) {
      parts.push({
        plain: queuedLabel,
        styled: theme.fg('warning', queuedLabel),
      });
    }
    const tpsLabel = state.tokensPerSec > 0 ? `${String(state.tokensPerSec).padStart(3)} t/s` : null;
    const tpsPart = tpsLabel
      ? {
          plain: tpsLabel,
          styled: theme.fg('text', tpsLabel),
        }
      : null;
    // Directory / branch / thread title (lowest priority on line 1)
    let dirText = opts.dir !== undefined ? opts.dir : opts.showDir ? centerText : null;

    // Measure width of everything except dir to know how much space remains.
    // Throughput and the context indicator are reserved at the far right even though they are appended after dir.
    const rightParts = indicatorPart ? [tpsPart, indicatorPart].filter(part => part !== null) : [];
    const nonDirParts = [...parts, ...rightParts];
    const nonDirWidth =
      useBadgeWidth + nonDirParts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0), 0);

    if (dirText !== null) {
      const dirPart = formatDirPart(dirText);
      const availableForDir = termWidth - nonDirWidth - SEP.length - 1; // -1 buffer for ambiguous-width chars
      const dirWidth = visibleWidth(dirPart.plain);
      const prefixWidth = githubPrLabel ? visibleWidth(githubPrLabel.plain) + (dirText ? 1 : 0) : 0;
      const availableForText = availableForDir - prefixWidth;
      const MIN_TRUNCATED_DIR = 10; // don't show a tiny sliver
      if (dirWidth > availableForDir && opts.allowDirTruncation === false) {
        return null;
      }
      if (dirWidth > availableForDir && availableForText >= MIN_TRUNCATED_DIR) {
        dirText = availableForText > 1 ? dirText.slice(0, availableForText - 1) + '…' : null;
      } else if (dirWidth > availableForDir) {
        // Preserve a standalone PR label when there is no room for the title.
        dirText = githubPrLabel && visibleWidth(githubPrLabel.plain) <= availableForDir ? '' : null;
      }
    }

    if (dirText !== null) {
      parts.push(formatDirPart(dirText));
    }
    if (indicatorPart) {
      parts.push(...rightParts);
    } else if (tpsPart) {
      parts.push(tpsPart);
    }
    const totalPlain =
      useBadgeWidth + parts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0), 0);

    if (totalPlain + 1 > termWidth) return null; // +1 buffer for ambiguous-width chars (▐▌)

    let styledLine: string;
    const hasDir = dirText !== null;
    if (indicatorPart && parts.length >= 2) {
      // Three groups: left (model + timing + goal), center (queue + dir/thread), right (throughput + context)
      const leftPartCount = opts.showQueue && goalLabel ? 2 : 1;
      const leftParts = parts.slice(0, leftPartCount);
      const centerParts = parts.slice(leftPartCount, -rightParts.length);
      const leftSeparatorPlain = timingLabel ? ' · ' : ' ';
      const leftSeparatorStyled = timingLabel ? ` ${theme.fg('success', '·')} ` : ' ';

      const leftWidth =
        useBadgeWidth +
        leftParts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? leftSeparatorPlain.length : 0), 0);
      const centerWidth = centerParts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0), 0);
      const rightWidth = rightParts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0), 0);
      const totalContent = leftWidth + centerWidth + rightWidth;
      const freeSpace = termWidth - totalContent;
      const gapLeft = Math.floor(freeSpace / 2);
      const gapRight = freeSpace - gapLeft;

      styledLine =
        useBadge +
        leftParts.map(p => p.styled).join(leftSeparatorStyled) +
        ' '.repeat(Math.max(gapLeft, 1)) +
        centerParts.map(p => p.styled).join(SEP) +
        ' '.repeat(Math.max(gapRight, 1)) +
        rightParts.map(p => p.styled).join(SEP);
    } else if (hasDir && parts.length === 2) {
      // Just model + dir, right-align dir
      const mainStr = useBadge + parts[0]!.styled;
      const dirPart = parts[parts.length - 1]!;
      const gap = termWidth - totalPlain;
      styledLine = mainStr + ' '.repeat(gap + SEP.length) + dirPart.styled;
    } else {
      styledLine = useBadge + parts.map(p => p.styled).join(SEP);
    }
    return { plain: '', styled: styledLine };
  };
  // Try progressively more compact layouts.
  // Preserve status content before the context indicator, which is a visual summary.
  const result =
    buildLine({
      modelId: fullModelId,
      showDir: false,
      dir: centerText,
      allowDirTruncation: false,
      showQueue: true,
    }) ??
    buildLine({
      modelId: fullModelId,
      showOMBar: false,
      showDir: false,
      dir: centerText,
      allowDirTruncation: false,
      showQueue: true,
    }) ??
    buildLine({ modelId: fullModelId, showOMBar: false, showDir: false, dir: centerTextShort, showQueue: true }) ??
    buildLine({ modelId: fullModelId, showOMBar: false, showDir: false, showQueue: true }) ??
    buildLine({ modelId: tinyModelId, showOMBar: false, showDir: false, showQueue: true }) ??
    buildLine({ modelId: tinyModelId, showOMBar: false, showDir: false, badge: 'short', showQueue: true }) ??
    buildLine({ modelId: tinyModelId, showOM: false, showDir: false, badge: 'short', showQueue: true }) ??
    buildLine({ modelId: tinyModelId, showOM: false, showDir: false }) ??
    buildLine({ modelId: '', showOMBar: false, showDir: false, badge: 'short', showQueue: true }) ??
    buildLine({ modelId: '', showOM: false, showDir: false, badge: 'short' });

  state.statusLine.setText(result?.styled ?? shortModeBadge + styleModelId(tinyModelId));

  // Line 2: hidden — dir only shows on line 1 when it fits
  if (state.memoryStatusLine) {
    state.memoryStatusLine.setText('');
  }

  state.ui.requestRender();
}
