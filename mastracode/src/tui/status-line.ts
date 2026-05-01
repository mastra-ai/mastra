/**
 * Status line rendering — builds the bottom-of-screen status bar
 * showing model, mode, memory progress, and project path.
 */
import { visibleWidth } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { applyGradientSweep } from './components/obi-loader.js';
import { formatObservationStatus, formatReflectionStatus } from './components/om-progress.js';
import type { TUIState } from './state.js';
import { theme, mastra, tintHex, getTermWidth } from './theme.js';

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

/**
 * Update the status line at the bottom of the TUI.
 * Progressively reduces content to fit the terminal width.
 */
export function updateStatusLine(state: TUIState): void {
  if (!state.statusLine) return;
  const termWidth = getTermWidth();
  const SEP = '  '; // double-space separator between parts

  // --- Determine if we're showing observer/reflector instead of main mode ---
  const omStatus = state.harness.getDisplayState().omProgress.status;
  const isObserving = omStatus === 'observing';
  const isReflecting = omStatus === 'reflecting';
  const showOMMode = isObserving || isReflecting;

  // --- Mode badge ---
  let modeBadge = '';
  let modeBadgeWidth = 0;
  const modes = state.harness.listModes();
  const currentMode = modes.length > 1 ? state.harness.getCurrentMode() : undefined;
  // Use OM color when observing/reflecting, otherwise mode color
  const mainModeColor = currentMode?.color;
  const modeColor = showOMMode ? (isObserving ? getObserverColor() : getReflectorColor()) : mainModeColor;
  // Tinted near-black background from mode color (shared between badge and model ID)
  const tintBg = modeColor ? tintHex(modeColor, 0.15) : undefined;
  // Badge name: use OM mode name when observing/reflecting, otherwise main mode name
  const badgeName = showOMMode
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
  // Show OM model when observing/reflecting, otherwise main model
  const rawModelId =
    (showOMMode
      ? isObserving
        ? state.harness.getObserverModelId()
        : state.harness.getReflectorModelId()
      : state.harness.getFullModelId()) ?? '';
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
  const queuedCount = state.pendingQueuedActions.length + state.harness.getFollowUpCount();
  const queuedLabel = queuedCount > 0 ? `${queuedCount} queued` : null;
  const goalState = state.goalManager.getGoal();
  const goalLabel = goalState?.status === 'active' ? `goal ${goalState.turnsUsed}/${goalState.maxTurns}` : null;
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

  const buildLine = (opts: {
    modelId: string;
    memCompact?: 'percentOnly' | 'noBuffer' | 'full';
    showDir: boolean;
    dir?: string | null;
    badge?: 'full' | 'short';
    showQueue?: boolean;
  }): { plain: string; styled: string } | null => {
    const parts: Array<{ plain: string; styled: string }> = [];
    // Model ID (always present) — styleModelId adds padding spaces
    parts.push({
      plain: `${opts.modelId}${tintBg ? ' ' : ''}`,
      styled: styleModelId(opts.modelId),
    });
    const useBadge = opts.badge === 'short' ? shortModeBadge : modeBadge;
    const useBadgeWidth = opts.badge === 'short' ? shortModeBadgeWidth : modeBadgeWidth;
    // Memory info — animate label text when buffering is active
    const ds = state.harness.getDisplayState();
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
    const omProg = state.harness.getDisplayState().omProgress;
    const obs = formatObservationStatus(omProg, opts.memCompact, msgLabelStyler);
    const ref = formatReflectionStatus(omProg, opts.memCompact, obsLabelStyler);
    if (obs) {
      parts.push({ plain: obs, styled: obs });
    }
    if (ref) {
      parts.push({ plain: ref, styled: ref });
    }
    if (opts.showQueue && queuedLabel) {
      parts.push({
        plain: queuedLabel,
        styled: theme.fg('warning', queuedLabel),
      });
    }
    if (opts.showQueue && goalLabel) {
      parts.push({
        plain: goalLabel,
        styled: theme.fg('accent', goalLabel),
      });
    }
    // Directory / branch / thread title (lowest priority on line 1)
    let dirText = opts.dir !== undefined ? opts.dir : opts.showDir ? dirFull : null;

    // Measure width of everything except dir to know how much space remains
    const nonDirWidth =
      useBadgeWidth + parts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0), 0);

    if (dirText) {
      const availableForDir = termWidth - nonDirWidth - SEP.length - 1; // -1 buffer for ambiguous-width chars
      const dirWidth = visibleWidth(dirText);
      const MIN_TRUNCATED_DIR = 10; // don't show a tiny sliver
      if (dirWidth > availableForDir && availableForDir >= MIN_TRUNCATED_DIR) {
        // Truncate to fit the remaining space
        dirText = dirText.slice(0, availableForDir - 1) + '…';
      } else if (dirWidth > availableForDir) {
        // Not enough room even for a truncated version — drop it
        dirText = null;
      }
    }

    if (dirText) {
      parts.push({
        plain: dirText,
        styled: theme.fg('dim', dirText),
      });
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
    buildLine({ modelId: fullModelId, memCompact: 'full', showDir: false, dir: dirFull, showQueue: true }) ??
    // 2. Full badge + full model + queue count + branch only (drop path)
    buildLine({ modelId: fullModelId, memCompact: 'full', showDir: false, dir: dirBranchOnly, showQueue: true }) ??
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
    // 8. Short badge + fractions (drop buffer indicator, keep queue count)
    buildLine({
      modelId: tinyModelId,
      memCompact: 'noBuffer',
      showDir: false,
      badge: 'short',
      showQueue: true,
    }) ??
    // 9. Full badge + percent only + queue count
    buildLine({
      modelId: tinyModelId,
      memCompact: 'percentOnly',
      showDir: false,
      badge: 'full',
      showQueue: true,
    }) ??
    // 10. Short badge + percent only + queue count
    buildLine({
      modelId: tinyModelId,
      memCompact: 'percentOnly',
      showDir: false,
      badge: 'short',
      showQueue: true,
    }) ??
    // 11. Model only + queue count
    buildLine({ modelId: tinyModelId, showDir: false, badge: undefined, showQueue: true }) ??
    // 12. Badge only + queue count
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
