import { describe, expect, it, vi } from 'vitest';
import { resolveSkillInvocation, resolveSkillResumeInvocation, SkillInvocationError } from './service.js';

const SKILL_INSTRUCTIONS = 'Follow the entire factory-review protocol in extensive detail.';

function makeController(options?: { skill?: unknown; session?: unknown }) {
  const skill =
    options && 'skill' in options ? options.skill : { name: 'factory-review', instructions: SKILL_INSTRUCTIONS };
  const session =
    options && 'session' in options
      ? options.session
      : {
          getWorkspace: () => ({
            skills: {
              maybeRefresh: vi.fn(async () => {}),
              refresh: vi.fn(async () => {}),
              get: vi.fn(async () => skill),
            },
          }),
          sendMessage: vi.fn(async () => {}),
        };
  return {
    getSession: vi.fn(async () => session as never),
  };
}

describe('resolveSkillResumeInvocation', () => {
  const input = { sessionId: 'card-1', name: 'factory-review', arguments: 'PR https://example/pull/7' };

  it('references the skill by name and carries the arguments without the full body', async () => {
    const resolved = await resolveSkillResumeInvocation(makeController(), input);
    expect(resolved.skillName).toBe('factory-review');
    expect(resolved.message).toContain('<skill name="factory-review">');
    expect(resolved.message).toContain('Resume the active factory-review session');
    expect(resolved.message).toContain('Re-open the factory-review skill with the skill tool');
    expect(resolved.message).toContain('ARGUMENTS: PR https://example/pull/7');
    // The whole point: the ~18KB skill body is NOT re-pasted on resume.
    expect(resolved.message).not.toContain(SKILL_INSTRUCTIONS);
  });

  it('omits the ARGUMENTS line when there are no fresh arguments', async () => {
    const resolved = await resolveSkillResumeInvocation(makeController(), {
      sessionId: 'card-1',
      name: 'factory-review',
    });
    expect(resolved.message).not.toContain('ARGUMENTS:');
  });

  it('does not embed the full skill body that the eager invocation pastes', async () => {
    const full = await resolveSkillInvocation(makeController(), input);
    const resume = await resolveSkillResumeInvocation(makeController(), input);
    expect(full.message).toContain(SKILL_INSTRUCTIONS);
    expect(resume.message).not.toContain(SKILL_INSTRUCTIONS);
  });

  it('throws skill_not_found for an unknown or non-user-invocable skill', async () => {
    await expect(resolveSkillResumeInvocation(makeController({ skill: undefined }), input)).rejects.toMatchObject({
      code: 'skill_not_found',
    });
    await expect(
      resolveSkillResumeInvocation(
        makeController({ skill: { name: 'factory-review', 'user-invocable': false } }),
        input,
      ),
    ).rejects.toBeInstanceOf(SkillInvocationError);
  });

  it('throws session_not_found when the resource has no session', async () => {
    await expect(resolveSkillResumeInvocation(makeController({ session: undefined }), input)).rejects.toMatchObject({
      code: 'session_not_found',
    });
  });
});

describe('resolveSkillInvocation', () => {
  it.each(['factory-review', 'factory-plan'])(
    'rescans a skill cache built before the session was given the binding %s needs',
    async name => {
      let scannedWithBinding = false;
      const skills = {
        maybeRefresh: vi.fn(async () => {}),
        refresh: vi.fn(async () => {
          scannedWithBinding = true;
        }),
        get: vi.fn(async () => (scannedWithBinding ? { name, instructions: SKILL_INSTRUCTIONS } : undefined)),
      };
      const controller = makeController({ session: { getWorkspace: () => ({ skills }) } });

      const resolved = await resolveSkillInvocation(controller, { sessionId: 'card-1', name });

      expect(resolved.skillName).toBe(name);
      expect(skills.refresh).toHaveBeenCalledTimes(1);
    },
  );

  it('does not rescan for a missing skill that no binding unlocks', async () => {
    const skills = {
      maybeRefresh: vi.fn(async () => {}),
      refresh: vi.fn(async () => {}),
      get: vi.fn(async () => undefined),
    };
    const controller = makeController({ session: { getWorkspace: () => ({ skills }) } });

    await expect(resolveSkillInvocation(controller, { sessionId: 'card-1', name: 'missing' })).rejects.toMatchObject({
      code: 'skill_not_found',
    });
    expect(skills.refresh).not.toHaveBeenCalled();
  });
});
