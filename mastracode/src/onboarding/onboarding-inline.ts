/**
 * Inline onboarding component.
 *
 * Walks the user through a multi-step wizard:
 *  1. Welcome
 *  2. Auth / Login prompt
 *  3. Mode pack selection (build / plan / fast model preset)
 *  4. OM pack selection (observational memory model)
 *  5. YOLO mode toggle
 *
 * The component renders each step inline in the conversation stream.
 * On completion it fires `onComplete` with the collected choices.
 */

import { Box, Container, SelectList, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable, SelectItem, TUI } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { theme, getSelectListTheme, mastra } from '../tui/theme.js';
import type { ModePack, OMPack } from './packs.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingResult {
  modePack: ModePack;
  omPack: OMPack;
  yolo: boolean;
  /** True if the user chose to log in (auth flow handled externally). */
  loginRequested: boolean;
  loginProvider?: string;
}

/** Previously saved selections to pre-populate when re-running /setup. */
export interface PreviousSetupChoices {
  modePackId: string | null;
  omPackId: string | null;
  yolo: boolean | null;
}

export interface OnboardingOptions {
  tui: TUI;
  /** OAuth providers available for login. label=display name, value=provider id */
  authProviders: Array<{ label: string; value: string; loggedIn: boolean }>;
  /** Available mode packs (pre-filtered by provider access). */
  modePacks: ModePack[];
  /** Available OM packs (pre-filtered by provider access). */
  omPacks: OMPack[];
  /** Whether the user has any provider access (API key or OAuth) — even for providers without a built-in pack. */
  hasProviderAccess: boolean;
  /** Previously saved choices — used to highlight current selections when re-running. */
  previous?: PreviousSetupChoices;
  /** Called when the wizard completes. */
  onComplete: (result: OnboardingResult) => void;
  /** Called if the user cancels the wizard (Esc on welcome). */
  onCancel: () => void;
  /** Called when the user requests login during onboarding. */
  onLogin: (providerId: string, done: () => void) => void;
  /** Show the model selector overlay and return the chosen model ID (or undefined on cancel). */
  onSelectModel: (title: string, modeColor?: string) => Promise<string | undefined>;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

type StepId = 'welcome' | 'auth' | 'modePack' | 'omPack' | 'yolo' | 'done';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class OnboardingInlineComponent extends Container implements Focusable {
  private tui: TUI;
  private options: OnboardingOptions;

  // Track which step we're on (written by renderStep for debugging / future use)
  private currentStep: StepId = 'welcome';
  private stepBox!: Box;
  private selectList?: SelectList;
  private _finished = false;

  // Collected choices
  private loginRequested = false;
  private loginProvider?: string;
  private selectedModePack!: ModePack;
  private selectedOmPack!: OMPack;
  private selectedYolo = true;

  // Focusable
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
  }

  constructor(options: OnboardingOptions) {
    super();
    this.tui = options.tui;
    this.options = options;

    // Initialize defaults — prefer previous selection if it still exists in the available packs
    const prevModePack = options.previous?.modePackId
      ? options.modePacks.find(p => p.id === options.previous!.modePackId)
      : undefined;
    this.selectedModePack = prevModePack ?? options.modePacks[0]!;

    const prevOmPack = options.previous?.omPackId
      ? options.omPacks.find(p => p.id === options.previous!.omPackId)
      : undefined;
    this.selectedOmPack = prevOmPack ??
      options.omPacks[0] ?? { id: 'none', name: 'None available', description: '', modelId: '' };

    if (options.previous?.yolo != null) {
      this.selectedYolo = options.previous.yolo;
    }

    this.renderStep('welcome');
  }

  get finished(): boolean {
    return this._finished;
  }

  /** Programmatically cancel the wizard (e.g. on Ctrl+C). */
  cancel(): void {
    if (this._finished) return;
    this._finished = true;
    this.collapseStep('Setup skipped — run /setup anytime to configure');
    this.options.onCancel();
  }

  /** Refresh the available mode packs (e.g. after a login grants new provider access). */
  updateModePacks(packs: ModePack[]): void {
    this.options.modePacks = packs;
    if (!this.selectedModePack || !packs.find(p => p.id === this.selectedModePack.id)) {
      this.selectedModePack = packs[0]!;
    }
  }

  /** Refresh the available OM packs (e.g. after a login grants new provider access). */
  updateOmPacks(packs: OMPack[]): void {
    this.options.omPacks = packs;
    if (!this.selectedOmPack || !packs.find(p => p.id === this.selectedOmPack.id)) {
      this.selectedOmPack = packs[0]!;
    }
  }

  /** Update whether the user has any provider access (e.g. after a login). */
  updateHasProviderAccess(hasAccess: boolean): void {
    this.options.hasProviderAccess = hasAccess;
  }

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------

  private clearStep(): void {
    if (this.stepBox) {
      this.removeChild(this.stepBox);
    }
    this.selectList = undefined;
  }

  private renderStep(step: StepId): void {
    this.currentStep = step;

    switch (step) {
      case 'welcome':
        return this.renderWelcome();
      case 'auth':
        return this.renderAuth();
      case 'modePack':
        return this.renderModePack();
      case 'omPack':
        return this.renderOmPack();
      case 'yolo':
        return this.renderYolo();
      case 'done':
        return this.renderDone();
    }
  }

  private stepCount = 0;

  private makeBox(): Box {
    this.clearStep();
    this.stepBox = new Box(1, 1, (text: string) => theme.bg('toolPendingBg', text));
    // Add a spacer between steps, but not before the very first one
    if (this.stepCount > 0) {
      this.addChild(new Spacer(1));
    }
    this.stepCount++;
    this.addChild(this.stepBox);
    return this.stepBox;
  }

  // ---------------------------------------------------------------------------
  // Step: Welcome
  // ---------------------------------------------------------------------------

  private renderWelcome(): void {
    const box = this.makeBox();
    box.addChild(new Text(theme.bold(theme.fg('accent', '👋 Welcome to Mastra Code')), 0, 0));
    box.addChild(new Spacer(1));
    box.addChild(new Text(theme.fg('text', "Let's configure your models and preferences."), 0, 0));
    box.addChild(new Text(chalk.white('You can re-run this anytime with /setup.'), 0, 0));
    box.addChild(new Spacer(1));

    const items: SelectItem[] = [
      { value: 'continue', label: `  ${theme.fg('success', 'Continue')}` },
      { value: 'skip', label: `  ${theme.fg('dim', 'Skip')}` },
    ];
    this.selectList = new SelectList(items, items.length, getSelectListTheme());
    this.selectList.onSelect = (item: SelectItem) => {
      if (item.value === 'continue') {
        this.collapseStep('Welcome');
        this.renderStep('auth');
      } else {
        this._finished = true;
        this.collapseStep('Setup skipped — run /setup anytime to configure');
        this.options.onCancel();
      }
    };
    this.selectList.onCancel = () => {
      this._finished = true;
      this.collapseStep('Setup skipped — run /setup anytime to configure');
      this.options.onCancel();
    };
    box.addChild(this.selectList);
  }

  // ---------------------------------------------------------------------------
  // Step: Auth
  // ---------------------------------------------------------------------------

  private renderAuth(): void {
    const box = this.makeBox();
    box.addChild(new Text(theme.bold(theme.fg('accent', '🔑 Authentication')), 0, 0));
    box.addChild(new Spacer(1));

    const providers = this.options.authProviders;
    if (providers.length === 0) {
      box.addChild(new Text(theme.fg('dim', 'No OAuth providers available. Skipping.'), 0, 0));
      // auto-advance after brief moment
      setTimeout(() => this.renderStep('modePack'), 100);
      return;
    }

    box.addChild(new Text(theme.fg('text', 'Log in with an AI provider to use your subscription,'), 0, 0));
    box.addChild(new Text(theme.fg('text', 'or skip if you have API keys configured as environment variables.'), 0, 0));
    box.addChild(new Spacer(1));

    const items: SelectItem[] = providers.map(p => ({
      value: p.value,
      label: p.loggedIn ? `  ${p.label}  ${theme.fg('success', '✓ logged in')}` : `  ${p.label}`,
    }));
    items.push({
      value: '__skip',
      label: `  ${theme.fg('dim', 'Skip (use API keys or configure later with /login)')}`,
    });

    this.selectList = new SelectList(items, Math.min(items.length, 8), getSelectListTheme());
    this.selectList.onSelect = (item: SelectItem) => {
      if (item.value === '__skip') {
        this.renderStep('modePack');
      } else {
        this.loginRequested = true;
        this.loginProvider = item.value;
        // Hand off to the external login flow; it calls `done()` when finished
        this.options.onLogin(item.value, () => {
          this.renderStep('modePack');
        });
      }
    };
    this.selectList.onCancel = () => {
      this.renderStep('modePack');
    };

    box.addChild(this.selectList);
    box.addChild(new Spacer(1));
    box.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc skip'), 0, 0));
  }

  // ---------------------------------------------------------------------------
  // Step: Mode pack
  // ---------------------------------------------------------------------------

  /** Text component showing details for the currently highlighted mode pack. */
  private modePackDetail?: Text;

  private renderModePack(): void {
    const packs = this.options.modePacks;

    // No API keys and no OAuth logins — can't proceed
    if (!this.options.hasProviderAccess) {
      const box = this.makeBox();
      box.addChild(new Text(theme.bold(theme.fg('error', 'No model providers configured')), 0, 0));
      box.addChild(new Spacer(1));
      box.addChild(new Text(theme.fg('text', 'To use Mastra Code you need at least one API key or OAuth login'), 0, 0));
      box.addChild(new Text(theme.fg('text', 'for Anthropic, OpenAI, or another supported provider.'), 0, 0));
      box.addChild(new Spacer(1));
      box.addChild(
        new Text(theme.fg('dim', 'See https://mastra.ai/models for supported providers and API key env vars.'), 0, 0),
      );
      box.addChild(new Spacer(1));
      box.addChild(
        new Text(theme.fg('dim', 'Set an API key and restart, or run /login to authenticate via OAuth.'), 0, 0),
      );
      this._finished = true;
      // Give the TUI time to render the message before exiting
      setTimeout(() => process.exit(1), 3000);
      return;
    }

    const box = this.makeBox();
    box.addChild(new Text(theme.bold(theme.fg('accent', 'Model Packs')), 0, 0));
    box.addChild(new Spacer(1));
    box.addChild(new Text(theme.fg('text', 'Choose default models for each mode (build / plan / fast):'), 0, 0));
    box.addChild(new Spacer(1));

    const prevId = this.options.previous?.modePackId ?? null;
    const items: SelectItem[] = packs.map(p => ({
      value: p.id,
      label: `  ${p.name}  ${theme.fg('dim', p.description)}${p.id === prevId ? theme.fg('dim', ' (current)') : ''}`,
    }));

    this.selectList = new SelectList(items, items.length, getSelectListTheme());

    // Pre-select the previously chosen pack
    const prevIdx = prevId ? packs.findIndex(p => p.id === prevId) : -1;
    if (prevIdx > 0) this.selectList.setSelectedIndex(prevIdx);

    this.selectList.onSelect = (item: SelectItem) => {
      const pack = packs.find(p => p.id === item.value) ?? packs[0]!;
      if (pack.id === 'custom') {
        this.runCustomPackFlow();
      } else {
        this.selectedModePack = pack;
        this.collapseStep(`Model pack → ${theme.bold(this.selectedModePack.name)}`);
        this.renderStep('omPack');
      }
    };
    this.selectList.onCancel = () => {
      this.collapseStep(`Model pack → ${theme.bold(this.selectedModePack.name)} (default)`);
      this.renderStep('omPack');
    };
    this.selectList.onSelectionChange = (item: SelectItem) => {
      this.updateModePackDetail(packs, item.value);
    };

    box.addChild(this.selectList);
    box.addChild(new Spacer(1));

    // Detail line — shows models for the currently highlighted pack
    this.modePackDetail = new Text('', 0, 0);
    box.addChild(this.modePackDetail);

    // Initialize detail for the highlighted item
    const initialId = prevIdx > 0 ? packs[prevIdx]!.id : packs[0]!.id;
    this.updateModePackDetail(packs, initialId);

    box.addChild(new Spacer(1));
    box.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc use default'), 0, 0));
  }

  private updateModePackDetail(packs: ModePack[], highlightedId: string): void {
    const pack = packs.find(p => p.id === highlightedId);
    if (!pack || !this.modePackDetail) return;

    if (pack.id === 'custom') {
      this.modePackDetail.setText(theme.fg('dim', "  You'll pick a model for each mode in the next steps."));
    } else {
      const detail = [
        `  ${chalk.hex(mastra.blue)('plan')}  → ${theme.fg('text', pack.models.plan)}`,
        `  ${chalk.hex(mastra.purple)('build')} → ${theme.fg('text', pack.models.build)}`,
        `  ${chalk.hex(mastra.green)('fast')}  → ${theme.fg('text', pack.models.fast)}`,
      ].join('\n');
      this.modePackDetail.setText(detail);
    }
    this.tui.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Custom pack flow — sequential model selection for each mode
  // ---------------------------------------------------------------------------

  private async runCustomPackFlow(): Promise<void> {
    // Clear the pack selector so it doesn't capture input while overlays are shown
    this.selectList = undefined;
    this.collapseStep('Model pack → Custom');

    const modes: Array<{ id: 'plan' | 'build' | 'fast'; label: string; color: string }> = [
      { id: 'plan', label: 'plan', color: mastra.blue },
      { id: 'build', label: 'build', color: mastra.purple },
      { id: 'fast', label: 'fast', color: mastra.green },
    ];

    const models: Record<string, string> = { build: '', plan: '', fast: '' };

    for (const mode of modes) {
      const title = `Select model for ${mode.label} mode`;
      const modelId = await this.options.onSelectModel(title, mode.color);

      if (!modelId) {
        // User cancelled — fall back to first non-custom pack (or keep current)
        const fallback = this.options.modePacks.find(p => p.id !== 'custom') ?? this.options.modePacks[0]!;
        this.selectedModePack = fallback;
        this.collapseStep(`Model pack → ${theme.bold(this.selectedModePack.name)} (cancelled custom)`);
        this.renderStep('omPack');
        this.tui.requestRender();
        return;
      }

      models[mode.id] = modelId;
    }

    this.selectedModePack = {
      id: 'custom',
      name: 'Custom',
      description: 'User-selected models',
      models: { build: models.build!, plan: models.plan!, fast: models.fast! },
    };

    this.collapseStep(
      `Model pack → ${theme.bold('Custom')}  ` +
        `${chalk.hex(mastra.blue)('plan')} ${models.plan}  ` +
        `${chalk.hex(mastra.purple)('build')} ${models.build}  ` +
        `${chalk.hex(mastra.green)('fast')} ${models.fast}`,
    );
    this.renderStep('omPack');
    this.tui.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Step: OM pack
  // ---------------------------------------------------------------------------

  private renderOmPack(): void {
    const omPacks = this.options.omPacks;

    // If no OM packs at all (unlikely — would mean zero supported providers),
    // skip to next step
    if (omPacks.length === 0) {
      this.renderStep('yolo');
      return;
    }

    const box = this.makeBox();
    box.addChild(new Text(theme.bold(theme.fg('accent', '🧠 Observational Memory')), 0, 0));
    box.addChild(new Spacer(1));
    box.addChild(new Text(theme.fg('text', 'Choose the model for observational memory:'), 0, 0));
    box.addChild(new Text(theme.fg('dim', 'https://mastra.ai/docs/memory/observational-memory'), 0, 0));
    box.addChild(new Spacer(1));

    const prevOmId = this.options.previous?.omPackId ?? null;
    const items: SelectItem[] = omPacks.map(p => ({
      value: p.id,
      label: `  ${p.name}  ${theme.fg('dim', p.description)}${p.id === prevOmId ? theme.fg('dim', ' (current)') : ''}`,
    }));

    this.selectList = new SelectList(items, items.length, getSelectListTheme());

    // Pre-select the previously chosen OM pack
    const prevOmIdx = prevOmId ? omPacks.findIndex(p => p.id === prevOmId) : -1;
    if (prevOmIdx > 0) this.selectList.setSelectedIndex(prevOmIdx);

    this.selectList.onSelect = (item: SelectItem) => {
      const pack = omPacks.find(p => p.id === item.value) ?? omPacks[0]!;
      if (pack.id === 'custom') {
        this.runCustomOmFlow();
      } else {
        this.selectedOmPack = pack;
        this.collapseStep(`Observational memory → ${theme.bold(this.selectedOmPack.name)}`);
        this.renderStep('yolo');
      }
    };
    this.selectList.onCancel = () => {
      this.collapseStep(`Observational memory → ${theme.bold(this.selectedOmPack.name)} (default)`);
      this.renderStep('yolo');
    };

    box.addChild(this.selectList);
    box.addChild(new Spacer(1));
    box.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc use default'), 0, 0));
  }

  private async runCustomOmFlow(): Promise<void> {
    this.selectList = undefined;
    this.collapseStep(`Observational memory → ${theme.bold('Custom')}`);

    const modelId = await this.options.onSelectModel('Select model for observational memory');
    if (modelId) {
      this.selectedOmPack = { id: 'custom', name: 'Custom', description: 'User-selected model', modelId };
      this.collapseStep(`Observational memory → ${theme.bold('Custom')}  ${modelId}`);
    } else {
      // Cancelled — fall back to first non-custom pack
      const fallback = this.options.omPacks.find(p => p.id !== 'custom');
      if (fallback) {
        this.selectedOmPack = fallback;
        this.collapseStep(`Observational memory → ${theme.bold(fallback.name)} (cancelled custom)`);
      } else {
        this.collapseStep(`Observational memory → ${theme.bold('Custom')} (cancelled)`);
      }
    }
    this.renderStep('yolo');
    this.tui.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Step: YOLO mode
  // ---------------------------------------------------------------------------

  private renderYolo(): void {
    const box = this.makeBox();
    box.addChild(new Text(theme.bold(theme.fg('accent', '⚡ Tool Approval')), 0, 0));
    box.addChild(new Spacer(1));
    box.addChild(new Text(theme.fg('text', 'YOLO mode auto-approves all tool calls (edits, commands, etc).'), 0, 0));
    box.addChild(new Text(theme.fg('text', 'You can toggle this anytime with Ctrl+Y or /yolo.'), 0, 0));
    box.addChild(new Spacer(1));

    const prevYolo = this.options.previous?.yolo ?? null;
    const currentOn = prevYolo === true ? theme.fg('dim', ' (current)') : '';
    const currentOff = prevYolo === false ? theme.fg('dim', ' (current)') : '';
    const items: SelectItem[] = [
      {
        value: 'on',
        label: `  ${theme.fg('success', 'Enable YOLO')}  ${theme.fg('dim', '(recommended — auto-approve everything)')}${currentOn}`,
      },
      {
        value: 'off',
        label: `  ${theme.fg('warning', 'Disable YOLO')}  ${theme.fg('dim', '(ask before each tool call)')}${currentOff}`,
      },
    ];

    this.selectList = new SelectList(items, items.length, getSelectListTheme());

    // Pre-select the previously chosen YOLO setting
    if (prevYolo === false) this.selectList.setSelectedIndex(1);
    this.selectList.onSelect = (item: SelectItem) => {
      this.selectedYolo = item.value === 'on';
      const label = this.selectedYolo ? 'enabled' : 'disabled';
      this.collapseStep(`YOLO mode → ${theme.bold(label)}`);
      this.renderStep('done');
    };
    this.selectList.onCancel = () => {
      this.collapseStep(`YOLO mode → ${theme.bold('enabled')} (default)`);
      this.renderStep('done');
    };

    box.addChild(this.selectList);
    box.addChild(new Spacer(1));
    box.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc use default'), 0, 0));
  }

  // ---------------------------------------------------------------------------
  // Step: Done
  // ---------------------------------------------------------------------------

  private renderDone(): void {
    this._finished = true;
    const box = this.makeBox();
    box.addChild(new Text(theme.bold(theme.fg('success', '✓ Setup complete!')), 0, 0));
    box.addChild(new Spacer(1));

    const lines = [
      `Model pack: ${theme.bold(this.selectedModePack.name)}`,
      `  ${chalk.hex(mastra.blue)('plan')}  → ${this.selectedModePack.models.plan}`,
      `  ${chalk.hex(mastra.purple)('build')} → ${this.selectedModePack.models.build}`,
      `  ${chalk.hex(mastra.green)('fast')}  → ${this.selectedModePack.models.fast}`,
      `Observational memory: ${theme.bold(this.selectedOmPack.name)}`,
      `YOLO mode: ${theme.bold(this.selectedYolo ? 'enabled' : 'disabled')}`,
    ];
    for (const line of lines) {
      box.addChild(new Text(theme.fg('text', line), 0, 0));
    }
    box.addChild(new Spacer(1));
    box.addChild(new Text(theme.fg('dim', 'Type a message to start coding, or use /help for commands.'), 0, 0));

    this.options.onComplete({
      modePack: this.selectedModePack,
      omPack: this.selectedOmPack,
      yolo: this.selectedYolo,
      loginRequested: this.loginRequested,
      loginProvider: this.loginProvider,
    });
  }

  // ---------------------------------------------------------------------------
  // Collapse a completed step into a single summary line
  // ---------------------------------------------------------------------------

  private collapseStep(summary: string): void {
    if (!this.stepBox) return;
    this.stepBox.clear();
    this.stepBox.setBgFn((text: string) => theme.bg('toolSuccessBg', text));
    this.stepBox.addChild(new Text(`${theme.fg('success', '✓')} ${theme.fg('text', summary)}`, 0, 0));
    this.selectList = undefined;
  }

  // ---------------------------------------------------------------------------
  // Input handling
  // ---------------------------------------------------------------------------

  handleInput(data: string): void {
    if (this._finished) return;

    if (this.selectList) {
      this.selectList.handleInput(data);
      return;
    }
  }
}
