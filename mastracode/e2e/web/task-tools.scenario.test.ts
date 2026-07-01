import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Web equivalent of MastraCode's task-tools flow: the agent calls the built-in
 * `task_write` tool, which executes and appears in the transcript as a tool card.
 * The tool result contains the created task list.
 */
describe('web scenario: task-tools', () => {
  it('executes task_write and renders the tool card in the transcript', async () => {
    await runScenario({
      name: 'task-tools',
      description: 'Agent creates a task list via task_write; tool card appears in transcript.',
      aimockFixture: 'task-tools.json',
      run: async ({ driver }) => {
        await driver.submit('Create a task list for setting up the project');

        // The task_write tool card renders in the transcript
        await driver.waitForText('task_write');

        // After the tool completes, the assistant summarizes
        await driver.waitForText('Install dependencies');
        await driver.waitForText('Configure the project');

        // Verify the task_updated event populated the transcript's task list
        const state = driver.state();
        expect(state.tasks.length).toBe(2);
        expect(state.tasks[0].content).toBe('Install dependencies');
        expect(state.tasks[0].status).toBe('pending');
        expect(state.tasks[1].content).toBe('Configure the project');
      },
    });
  });
});
