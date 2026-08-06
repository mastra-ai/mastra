import { Text, visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { JudgeDisplayComponent } from '../judge-display.js';
import { NotificationComponent } from '../notification.js';
import { OMOutputComponent } from '../om-output.js';
import { ShellStreamComponent } from '../shell-output.js';
import { SlashCommandComponent } from '../slash-command.js';
import { SubagentExecutionComponent } from '../subagent-execution.js';
import { SystemReminderComponent } from '../system-reminder.js';
import { TaskProgressComponent } from '../task-progress.js';
import { ToolExecutionComponentEnhanced } from '../tool-execution-enhanced.js';
import { WidthAwareContainer } from '../width-aware-container.js';

const ui = { requestRender() {} } as any;
const source =
  'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau unique-restored-tail';

function expectReflow(component: { render(width: number): string[] }, wide = 140, narrow = 42): void {
  const firstWide = component.render(wide);
  const narrowLines = component.render(narrow);
  const restoredWide = component.render(wide);

  expect(narrowLines.every(line => visibleWidth(line) <= narrow)).toBe(true);
  expect(firstWide.every(line => visibleWidth(line) <= wide)).toBe(true);
  expect(restoredWide).toEqual(firstWide);
  expect(narrowLines).not.toEqual(firstWide);
}

describe('width-aware custom component rendering', () => {
  it('rebuilds only when the received width changes', () => {
    class CountingComponent extends WidthAwareContainer {
      builds = 0;

      protected rebuildForWidth(width: number): void {
        this.builds += 1;
        this.clear();
        this.addChild(new Text(String(width), 0, 0));
      }
    }

    const component = new CountingComponent();
    component.render(80);
    component.render(80);
    component.render(40);
    component.render(40);
    component.render(80);

    expect(component.builds).toBe(3);
  });

  it('reflows judge output without changing its result', () => {
    const component = new JudgeDisplayComponent({ decision: 'continue', reason: source }, 2, 10);
    expectReflow(component);
    expect(component.render(140).join('\n')).toContain('unique-restored-tail');
  });

  it('reflows notifications while retaining metadata and source content', () => {
    const component = new NotificationComponent({
      message: source,
      source: 'goal-judge',
      priority: 'high',
      kind: 'status',
    });
    expectReflow(component);
    expect(component.render(140).join('\n')).toContain('unique-restored-tail');
  });

  it('reflows expanded observational-memory output without collapsing it', () => {
    const component = new OMOutputComponent({ type: 'observation', observations: source });
    component.setExpanded(true);
    expectReflow(component);
    expect(component.render(140).join('\n')).toContain('unique-restored-tail');
  });

  it('reflows streaming shell output without changing expansion or its buffer', () => {
    const component = new ShellStreamComponent('printf output');
    component.setExpanded(true);
    component.appendOutput(source);
    expectReflow(component);
    expect(component.isExpanded()).toBe(true);
    expect(component.render(140).join('\n')).toContain('unique-restored-tail');
  });

  it('reflows expanded slash-command output without collapsing it', () => {
    const component = new SlashCommandComponent('review', source);
    component.setExpanded(true);
    expectReflow(component);
    expect(component.render(140).join('\n')).toContain('unique-restored-tail');
  });

  it('renders slash-command output at widths narrower than its fixed chrome', () => {
    const component = new SlashCommandComponent('review', source);
    expect(component.render(8).length).toBeGreaterThan(0);
  });

  it('reflows subagent activity without changing completion or expansion state', () => {
    const component = new SubagentExecutionComponent('explore', source, ui);
    component.setExpanded(true);
    component.addText(source);
    component.finish(false, 25, source);
    expectReflow(component);
    expect(component.render(140).join('\n')).toContain('unique-restored-tail');
  });

  it('renders subagent tasks at widths narrower than their fixed chrome', () => {
    const component = new SubagentExecutionComponent('explore', source, ui);
    expect(component.render(8).length).toBeGreaterThan(0);
  });

  it('reflows expanded system reminders without collapsing them', () => {
    const component = new SystemReminderComponent({ message: source, reminderType: 'goal-judge' });
    component.setExpanded(true);
    expectReflow(component);
    expect(component.isExpanded()).toBe(true);
    expect(component.render(140).join('\n')).toContain('unique-restored-tail');
  });

  it('reflows quiet task progress without changing task status', () => {
    const component = new TaskProgressComponent();
    component.updateTasks([
      { id: 'active', content: source, activeForm: source, status: 'in_progress' },
      { id: 'pending', content: source, activeForm: source, status: 'pending' },
    ]);
    component.setQuietMode(true);
    expectReflow(component);
    expect(component.getTasks().map(task => task.status)).toEqual(['in_progress', 'pending']);
  });

  it('reflows enhanced tool output without changing quiet, streaming, or partial state', () => {
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: source },
      { quietDisplayMode: 'quiet', collapsedByDefault: false },
      ui,
    );
    component.appendStreamingOutput(source);
    expectReflow(component);
    expect(component.getChatSpacingKind()).toBe('quiet-shell-tool');
    expect(component.isComplete()).toBe(false);
    expect(component.render(140).join('\n')).toContain('unique-restored-tail');
  });
});
