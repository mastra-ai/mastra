/**
 * Status line rendering — builds the bottom-of-screen status bar
 * showing model, mode, memory progress, and project path.
 */
import { visibleWidth } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { applyGradientSweep } from './components/obi-loader.js';
import { formatObservationStatus, formatReflectionStatus } from './components/om-progress.js';
import type { TUIState } from './state.js';
import { theme, mastra, tintHex, getThemeMode } from './theme.js';

// Colors for OM modes
const OBSERVER_COLOR = mastra.orange;
const REFLECTOR_COLOR = mastra.pink;

/**
 * Lighten a color by blending toward white. factor 0 = original, 1 = white.
 */
function lighten(r: number, g: number, b: number, factor: number): [number, number, number] {
  return [Math.floor(r + (255 - r) * factor), Math.floor(g + (255 - g) * factor), Math.floor(b + (255 - b) * factor)];
}

/**
 * For light mode, purple and blue badge backgrounds are too dark.
 * Lighten them slightly so they look better on light terminals.
 */
function adjustBadgeColor(r: number, g: number, b: number, modeColor: string): [number, number, number] {
  if (getThemeMode() !== 'light') return [r, g, b];
  if (modeColor === mastra.purple || modeColor === mastra.blue) {
    return lighten(r, g, b, 0.25);
  }
  return [r, g, b];
}

/**
 * Update the status line at the bottom of the TUI.
 * Progressively reduces content to fit the terminal width.
 */
export function updateStatusLine(state: TUIState): void {
  if (!state.statusLine) return;
  const termWidth = (process.stdout.columns || 80) - 1; // buffer to prevent jitter
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
  const modeColor = showOMMode ? (isObserving ? OBSERVER_COLOR : REFLECTOR_COLOR) : mainModeColor;
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
      if (fade < 1) {
        const offset = state.gradientAnimator.getOffset() % 1;
        // Inverted phase (+ PI), range 0.65-0.95
        const animBrightness = 0.65 + 0.3 * (0.5 + 0.5 * Math.sin(offset * Math.PI * 2 + Math.PI));
        // Interpolate toward idle (0.9) as fade progresses
        badgeBrightness = animBrightness + (0.9 - animBrightness) * fade;
      }
    }
    const [mr, mg, mb] = adjustBadgeColor(
      Math.floor(mcr * badgeBrightness),
      Math.floor(mcg * badgeBrightness),
      Math.floor(mcb * badgeBrightness),
      modeColor,
    );
    modeBadge = chalk.bgRgb(mr, mg, mb).hex('#000000').bold(` ${badgeName.toLowerCase()} `);
    modeBadgeWidth = badgeName.length + 2;
  } else if (badgeName) {
    modeBadge = theme.fg('dim', badgeName) + ' ';
    modeBadgeWidth = badgeName.length + 1;
  }

  // --- Update editor border to match mode color (not OM color) ---
  if (mainModeColor) {
    const [br, bg, bb] = [
      parseInt(mainModeColor.slice(1, 3), 16),
      parseInt(mainModeColor.slice(3, 5), 16),
      parseInt(mainModeColor.slice(5, 7), 16),
    ];
    const dim = 0.35;
    state.editor.borderColor = (text: string) =>
      chalk.rgb(Math.floor(br * dim), Math.floor(bg * dim), Math.floor(bb * dim))(text);
  }

  // --- Collect raw data ---
  // Show OM model when observing/reflecting, otherwise main model
  const fullModelId = showOMMode
    ? isObserving
      ? state.harness.getObserverModelId()
      : state.harness.getReflectorModelId()
    : state.harness.getFullModelId();
  // e.g. "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4-20250514"
  const shortModelId = fullModelId.includes('/') ? fullModelId.slice(fullModelId.indexOf('/') + 1) : fullModelId;
  // e.g. "claude-opus-4-6" → "opus 4.6", "claude-sonnet-4-20250514" → "sonnet-4-20250514"
  const tinyModelId = shortModelId.replace(/^claude-/, '').replace(/^(\w+)-(\d+)-(\d{1,2})$/, '$1 $2.$3');

  const homedir = process.env.HOME || process.env.USERPROFILE || '';
  let displayPath = state.projectInfo.rootPath;
  if (homedir && displayPath.startsWith(homedir)) {
    displayPath = '~' + displayPath.slice(homedir.length);
  }
  const branch = state.projectInfo.gitBranch;
  // Build progressively shorter directory strings for layout fallback
  const dirFull = branch ? `${displayPath} (${branch})` : displayPath;
  const dirBranchOnly = branch || null;
  // Abbreviate long branches: keep first 12 + last 8 chars with ".." in between
  const dirBranchShort = branch && branch.length > 24 ? branch.slice(0, 12) + '..' + branch.slice(-8) : dirBranchOnly;

  // --- Helper to style the model ID ---
  const isYolo = (state.harness.getState() as any).yolo === true;
  const styleModelId = (id: string): string => {
    if (!state.modelAuthStatus.hasAuth) {
      const envVar = state.modelAuthStatus.apiKeyEnvVar;
      return theme.fg('dim', id) + theme.fg('error', ' ✗') + theme.fg('muted', envVar ? ` (${envVar})` : ' (no key)');
    }
    // Tinted near-black background from mode color
    const tintBg = modeColor ? tintHex(modeColor, 0.15) : undefined;
    const padded = ` ${id} `;

    if (state.gradientAnimator?.isRunning() && modeColor) {
      const fade = state.gradientAnimator.getFadeProgress();
      if (fade < 1) {
        // During active or fade-out: interpolate gradient toward idle color
        const text = applyGradientSweep(
          padded,
          state.gradientAnimator.getOffset(),
          modeColor,
          fade, // pass fade progress to flatten the gradient
        );
        return tintBg ? chalk.bgHex(tintBg)(text) : text;
      }
    }
    if (modeColor) {
      // Idle state
      const [r, g, b] = adjustBadgeColor(
        parseInt(modeColor.slice(1, 3), 16),
        parseInt(modeColor.slice(3, 5), 16),
        parseInt(modeColor.slice(5, 7), 16),
        modeColor,
      );
      const dim = 0.8;
      const fgStyled = chalk.rgb(Math.floor(r * dim), Math.floor(g * dim), Math.floor(b * dim)).bold(padded);
      return tintBg ? chalk.bgHex(tintBg)(fgStyled) : fgStyled;
    }
    return chalk.hex(mastra.specialGray).bold(id);
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
    const [sr, sg, sb] = adjustBadgeColor(
      Math.floor(mcr * sBadgeBrightness),
      Math.floor(mcg * sBadgeBrightness),
      Math.floor(mcb * sBadgeBrightness),
      modeColor,
    );
    shortModeBadge = chalk.bgRgb(sr, sg, sb).hex('#000000').bold(` ${shortName} `);
    shortModeBadgeWidth = shortName.length + 2;
  } else if (badgeName) {
    const shortName = badgeName.toLowerCase().charAt(0);
    shortModeBadge = theme.fg('dim', shortName) + ' ';
    shortModeBadgeWidth = shortName.length + 1;
  }

  const buildLine = (opts: {
    modelId: string;
    memCompact?: 'percentOnly' | 'noBuffer' | 'full';
    showDir: boolean;
    dir?: string | null;
    badge?: 'full' | 'short';
  }): { plain: string; styled: string } | null => {
    const parts: Array<{ plain: string; styled: string }> = [];
    // Model ID (always present) — styleModelId adds padding spaces
    // When YOLO, append ⚒ box flush (no SEP gap)
    if (isYolo && modeColor) {
      const yBox = chalk.bgHex(tintHex(modeColor, 0.25)).hex(tintHex(modeColor, 0.9)).bold(' ⚒ ');
      parts.push({
        plain: ` ${opts.modelId}  ⚒ `,
        styled: styleModelId(opts.modelId) + yBox,
      });
    } else {
      parts.push({
        plain: ` ${opts.modelId} `,
        styled: styleModelId(opts.modelId),
      });
    }
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
              OBSERVER_COLOR,
              state.gradientAnimator!.getFadeProgress(),
            )
        : undefined;
    const obsLabelStyler =
      ds.bufferingObservations && state.gradientAnimator?.isRunning()
        ? (label: string) =>
            applyGradientSweep(
              label,
              state.gradientAnimator!.getOffset(),
              REFLECTOR_COLOR,
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
    // Directory / branch (lowest priority on line 1)
    const dirText = opts.dir !== undefined ? opts.dir : opts.showDir ? dirFull : null;
    if (dirText) {
      parts.push({
        plain: dirText,
        styled: theme.fg('dim', dirText),
      });
    }
    const totalPlain =
      useBadgeWidth + parts.reduce((sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0), 0);

    if (totalPlain > termWidth) return null;

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
    // 1. Full badge + full model + long labels + fractions + buffer + full dir
    buildLine({ modelId: fullModelId, memCompact: 'full', showDir: false, dir: dirFull }) ??
    // 2. Full badge + full model + branch only (drop path)
    buildLine({ modelId: fullModelId, memCompact: 'full', showDir: false, dir: dirBranchOnly }) ??
    // 3. Full badge + full model + abbreviated branch
    buildLine({ modelId: fullModelId, memCompact: 'full', showDir: false, dir: dirBranchShort }) ??
    // 4. Drop directory entirely
    buildLine({ modelId: fullModelId, memCompact: 'full', showDir: false }) ??
    // 5. Drop provider + "claude-" prefix, keep full labels + fractions + buffer
    buildLine({ modelId: tinyModelId, memCompact: 'full', showDir: false }) ??
    // 6. Short labels (msg/mem) + fractions + buffer
    buildLine({ modelId: tinyModelId, showDir: false }) ??
    // 7. Short badge + short labels + fractions + buffer
    buildLine({ modelId: tinyModelId, showDir: false, badge: 'short' }) ??
    // 8. Short badge + fractions (drop buffer indicator)
    buildLine({
      modelId: tinyModelId,
      memCompact: 'noBuffer',
      showDir: false,
      badge: 'short',
    }) ??
    // 9. Full badge + percent only
    buildLine({
      modelId: tinyModelId,
      memCompact: 'percentOnly',
      showDir: false,
    }) ??
    // 10. Short badge + percent only
    buildLine({
      modelId: tinyModelId,
      memCompact: 'percentOnly',
      showDir: false,
      badge: 'short',
    });

  state.statusLine.setText(
    result?.styled ??
      shortModeBadge +
        styleModelId(tinyModelId) +
        (isYolo && modeColor ? chalk.bgHex(tintHex(modeColor, 0.25)).hex(tintHex(modeColor, 0.9)).bold(' ⚒ ') : ''),
  );

  // Line 2: hidden — dir only shows on line 1 when it fits
  if (state.memoryStatusLine) {
    state.memoryStatusLine.setText('');
  }

  state.ui.requestRender();
}
