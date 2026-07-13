/**
 * Status line rendering — builds the bottom-of-screen status bar
 * showing model, mode, memory progress, and project path.
 */
import { visibleWidth } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { applyGradientSweep } from './components/obi-loader.js';
import { formatObservationStatus, formatReflectionStatus } from './components/om-progress.js';
import type { GithubPrSubscriptionBadge, TUIState } from './state.js';
import { formatStatusDuration } from './status-duration.js';
import { theme, mastra, tintHex, getTermWidth, extendedColors } from './theme.js';

// Colors for OM modes — read from proxy at render time so they pick up contrast adaptation
const getObserverColor = () => mastra.orange;
const getReflectorColor = () => mastra.pink;

/** Returns true if a thread title is generic/auto-generated and should not be displayed. */
function isGenericTitle(title: string): boolean {
  const lower = title.toLowerCase().trim();
  return (
    lower === 'new thread' ||
    lower.startsWith('new thread') ||
    lower.startsWith('clone of') ||
    lower.startsWith('untitled')
  );
}

function formatGithubPrLabel(
  state: TUIState,
  subscription: GithubPrSubscriptionBadge,
): { plain: string; styled: string } {
  const plain = `PR#${subscription.prNumber}`;
  const label = plain;
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

function formatGoalDuration(goal: { startedAt: string; activeStartedAt?: string; activeDurationMs?: number }): string {
  const activeStartedAt = goal.activeStartedAt ?? (goal.activeDurationMs === undefined ? goal.startedAt : undefined);
  const startedMs = activeStartedAt ? Date.parse(activeStartedAt) : NaN;
  const activeRunMs = Number.isFinite(startedMs) ? Math.max(0, Date.now() - startedMs) : 0;
  const elapsedMinutes = Math.floor(((goal.activeDurationMs ?? 0) + activeRunMs) / 60_000);
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
  const omStatus = state.session.displayState.get().omProgress.status;
  const isJudging = Boolean(state.activeGoalJudge);
  const isObserving = omStatus === 'observing';
  const isReflecting = omStatus === 'reflecting';
  const showOMMode = !isJudging && (isObserving || isReflecting);

  // --- Mode badge ---
  let modeBadge = '';
  let modeBadgeWidth = 0;
  const modes = state.controller.listModes();
  const currentMode = modes.length > 1 ? state.session.mode.resolve() : undefined;
  const judgeModeColor = mastra.blue;
  // Use judge color for goal judge activity, OM color for OM activity, otherwise mode color
  const currentModeColor = currentMode?.metadata?.color;
  const mainModeColor = typeof currentModeColor === 'string' ? currentModeColor : undefined;
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

  const homedir = process.env.HOME || process.env.USERPROFILE || '';
  // Use thread title if available and not generic, otherwise use project root path
  const threadTitle =
    state.currentThreadTitle && !isGenericTitle(state.currentThreadTitle) ? state.currentThreadTitle : null;
  let displayPath = threadTitle || state.projectInfo.rootPath;
  if (!threadTitle && homedir && displayPath.startsWith(homedir)) {
    displayPath = '~' + displayPath.slice(homedir.length);
  }
  const branch = state.projectInfo.gitBranch;
  const queuedCount = state.pendingQueuedActions.length + state.session.followUps.count();
  const queuedLabel = queuedCount > 0 ? `${queuedCount} queued` : null;
  const goalState = state.goalManager?.getGoal();
  const goalDuration = !isJudging && goalState?.status === 'active' ? formatGoalDuration(goalState) : null;
  const goalLabel = goalDuration ? `pursuing goal (${goalDuration})` : null;
  const shortGoalLabel = goalDuration ? `goal (${goalDuration})` : null;
  const activeGithubPr = state.activeGithubPrSubscriptions?.[0];
  const githubPrLabel = activeGithubPr ? formatGithubPrLabel(state, activeGithubPr) : null;
  const formatDirPart = (value: string) => {
    if (!githubPrLabel) return { plain: value, styled: theme.fg('dim', value) };
    return {
      plain: `${githubPrLabel.plain} ${value}`,
      styled: `${githubPrLabel.styled} ${theme.fg('dim', value)}`,
    };
  };
  // Build progressively shorter directory strings for layout fallback
  // Only show branch when not showing thread title (thread title takes priority)
  const dirFull = !threadTitle && branch ? `${displayPath} (${branch})` : displayPath;
  const dirBranchOnly = !threadTitle && branch ? branch : null;
  // Abbreviate long branches: keep first 12 + last 8 chars with ".." in between
  const dirBranchShort =
    !threadTitle && branch && branch.length > 24 ? branch.slice(0, 12) + '..' + branch.slice(-8) : dirBranchOnly;

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

  const now = Date.now();
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
    memCompact?: 'percentOnly' | 'noBuffer' | 'full';
    showDir: boolean;
    dir?: string | null;
    allowDirTruncation?: boolean;
    badge?: 'full' | 'short';
    showQueue?: boolean;
    compactGoal?: boolean;
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
    // Memory info — animate label text when buffering is active
    const ds = state.session.displayState.get();
    const msgLabelStyler =
      ds.bufferingMessages && state.gradientAnimator?.isRunning()
        ? (label: string) =>
            applyGradientSweep(
              label,
              state.gradientAnimator!.getOffset(),
              getObserverColor(),
              state.gradientAnimator!.getFadeProgress(),
            )
        : undefined;
    const obsLabelStyler =
      ds.bufferingObservations && state.gradientAnimator?.isRunning()
        ? (label: string) =>
            applyGradientSweep(
              label,
              state.gradientAnimator!.getOffset(),
              getReflectorColor(),
              state.gradientAnimator!.getFadeProgress(),
            )
        : undefined;
    const omProg = state.session.displayState.get().omProgress;
    const obs = isJudging ? '' : formatObservationStatus(omProg, opts.memCompact, msgLabelStyler);
    const ref = isJudging ? '' : formatReflectionStatus(omProg, opts.memCompact, obsLabelStyler);
    if (obs) {
      parts.push({ plain: obs, styled: obs });
    }
    if (ref) {
      parts.push({ plain: ref, styled: ref });
    }
    if (state.tokensPerSec > 0) {
      const tpsLabel = `${state.tokensPerSec} tok/s`;
      parts.push({
        plain: tpsLabel,
        styled: theme.fg('dim', tpsLabel),
      });
    }
    if (opts.showQueue && queuedLabel) {
      parts.push({
        plain: queuedLabel,
        styled: theme.fg('warning', queuedLabel),
      });
    }
    const renderedGoalLabel = opts.compactGoal ? shortGoalLabel : goalLabel;
    if (opts.showQueue && renderedGoalLabel) {
      parts.push({
        plain: renderedGoalLabel,
        styled: theme.fg('accent', renderedGoalLabel),
      });
    }
    // Directory / branch / thread title (lowest priority on line 1)
    let dirText = opts.dir !== undefined ? opts.dir : opts.showDir ? dirFull : null;

    // Measure width of everything except dir to know how much space remains
    const nonDirWidth =
      useBadgeWidth + parts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0), 0);

    if (dirText) {
      const dirPart = formatDirPart(dirText);
      const availableForDir = termWidth - nonDirWidth - SEP.length - 1; // -1 buffer for ambiguous-width chars
      const dirWidth = visibleWidth(dirPart.plain);
      const MIN_TRUNCATED_DIR = 10; // don't show a tiny sliver
      if (dirWidth > availableForDir && opts.allowDirTruncation === false) {
        return null;
      }
      if (dirWidth > availableForDir && availableForDir >= MIN_TRUNCATED_DIR) {
        const reservedPrefix = githubPrLabel ? `${githubPrLabel.plain} ` : '';
        const availableForText = availableForDir - visibleWidth(reservedPrefix);
        dirText = availableForText > 1 ? dirText.slice(0, availableForText - 1) + '…' : null;
      } else if (dirWidth > availableForDir) {
        // Not enough room even for a truncated version — drop it
        dirText = null;
      }
    }

    if (dirText) {
      parts.push(formatDirPart(dirText));
    }
    const totalPlain =
      useBadgeWidth + parts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0), 0);

    if (totalPlain + 1 > termWidth) return null; // +1 buffer for ambiguous-width chars (▐▌)

    let styledLine: string;
    const hasDir = !!dirText;
    if (hasDir && parts.length >= 3) {
      // Three groups: left (model), center (mem/tokens/thinking), right (dir)
      const leftPart = parts[0]!; // model
      const centerParts = parts.slice(1, -1); // mem, tokens, thinking
      const dirPart = parts[parts.length - 1]!; // dir

      const leftWidth = useBadgeWidth + visibleWidth(leftPart.plain);
      const centerWidth = centerParts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0), 0);
      const rightWidth = visibleWidth(dirPart.plain);
      const totalContent = leftWidth + centerWidth + rightWidth;
      const freeSpace = termWidth - totalContent;
      const gapLeft = Math.floor(freeSpace / 2);
      const gapRight = freeSpace - gapLeft;

      styledLine =
        useBadge +
        leftPart.styled +
        ' '.repeat(Math.max(gapLeft, 1)) +
        centerParts.map(p => p.styled).join(SEP) +
        ' '.repeat(Math.max(gapRight, 1)) +
        dirPart.styled;
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
  // Priority: token fractions + buffer > labels > provider > badge > buffer > fractions
  const result =
    // 1. Full badge + full model + long labels + queue count + full dir
    buildLine({
      modelId: fullModelId,
      memCompact: 'full',
      showDir: false,
      dir: dirFull,
      allowDirTruncation: false,
      showQueue: true,
    }) ??
    // 2. Full badge + full model + queue count + branch only (drop path)
    buildLine({
      modelId: fullModelId,
      memCompact: 'full',
      showDir: false,
      dir: dirBranchOnly,
      allowDirTruncation: false,
      showQueue: true,
    }) ??
    // 3. Full badge + full model + queue count + abbreviated branch
    buildLine({ modelId: fullModelId, memCompact: 'full', showDir: false, dir: dirBranchShort, showQueue: true }) ??
    // 4. Drop directory entirely
    buildLine({ modelId: fullModelId, memCompact: 'full', showDir: false, showQueue: true }) ??
    // 5. Drop provider + "claude-" prefix, keep full labels + queue count
    buildLine({ modelId: tinyModelId, memCompact: 'full', showDir: false, showQueue: true }) ??
    // 6. Short labels (msg/mem) + queue count
    buildLine({ modelId: tinyModelId, showDir: false, showQueue: true }) ??
    // 7. Short badge + short labels + queue count
    buildLine({ modelId: tinyModelId, showDir: false, badge: 'short', showQueue: true }) ??
    // 8. Short badge + short labels + compact goal label
    buildLine({ modelId: tinyModelId, showDir: false, badge: 'short', showQueue: true, compactGoal: true }) ??
    // 9. Short badge + fractions (drop buffer indicator, keep queue count)
    buildLine({
      modelId: tinyModelId,
      memCompact: 'noBuffer',
      showDir: false,
      badge: 'short',
      showQueue: true,
    }) ??
    // 10. Short badge + fractions + compact goal label
    buildLine({
      modelId: tinyModelId,
      memCompact: 'noBuffer',
      showDir: false,
      badge: 'short',
      showQueue: true,
      compactGoal: true,
    }) ??
    // 11. Full badge + percent only + queue count
    buildLine({
      modelId: tinyModelId,
      memCompact: 'percentOnly',
      showDir: false,
      badge: 'full',
      showQueue: true,
    }) ??
    // 12. Full badge + percent only + compact goal label
    buildLine({
      modelId: tinyModelId,
      memCompact: 'percentOnly',
      showDir: false,
      badge: 'full',
      showQueue: true,
      compactGoal: true,
    }) ??
    // 13. Short badge + percent only + queue count
    buildLine({
      modelId: tinyModelId,
      memCompact: 'percentOnly',
      showDir: false,
      badge: 'short',
      showQueue: true,
    }) ??
    // 14. Short badge + percent only + compact goal label
    buildLine({
      modelId: tinyModelId,
      memCompact: 'percentOnly',
      showDir: false,
      badge: 'short',
      showQueue: true,
      compactGoal: true,
    }) ??
    // 15. Model only + queue count
    buildLine({ modelId: tinyModelId, showDir: false, badge: undefined, showQueue: true }) ??
    // 16. Model only + compact goal label
    buildLine({ modelId: tinyModelId, showDir: false, badge: undefined, showQueue: true, compactGoal: true }) ??
    // 17. Badge only + queue count
    buildLine({ modelId: '', showDir: false, badge: 'short', showQueue: true }) ??
    // 13. Model only
    buildLine({ modelId: tinyModelId, showDir: false, badge: undefined }) ??
    // 14. Badge only
    buildLine({ modelId: '', showDir: false, badge: 'short' });

  state.statusLine.setText(result?.styled ?? shortModeBadge + styleModelId(tinyModelId));

  // Line 2: hidden — dir only shows on line 1 when it fits
  if (state.memoryStatusLine) {
    state.memoryStatusLine.setText('');
  }

  state.ui.requestRender();
}
