import { describe, expect, it, vi } from 'vitest';
import {
  formatSkillMessage,
  resolveSkillInvocation,
  resolveSkillResumeInvocation,
  SkillInvocationError,
} from './service.js';

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
    // The signal carries the skill name; the contents are the bare body.
    expect(resolved.contents).not.toContain('<skill');
    expect(resolved.contents).toContain('Resume the active factory-review session');
    expect(resolved.contents).toContain('Re-open the factory-review skill with the skill tool');
    expect(resolved.contents).toContain('ARGUMENTS: PR https://example/pull/7');
    // The whole point: the ~18KB skill body is NOT re-pasted on resume.
    expect(resolved.contents).not.toContain(SKILL_INSTRUCTIONS);
  });

  it('omits the ARGUMENTS line when there are no fresh arguments', async () => {
    const resolved = await resolveSkillResumeInvocation(makeController(), {
      sessionId: 'card-1',
      name: 'factory-review',
    });
    expect(resolved.contents).not.toContain('ARGUMENTS:');
  });

  it('does not embed the full skill body that the eager invocation pastes', async () => {
    const full = await resolveSkillInvocation(makeController(), input);
    const resume = await resolveSkillResumeInvocation(makeController(), input);
    expect(full.contents).toContain(SKILL_INSTRUCTIONS);
    expect(resume.contents).not.toContain(SKILL_INSTRUCTIONS);
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
  it('rescans a skill cache built before the session was given its review binding', async () => {
    let scannedAsReview = false;
    const skills = {
      maybeRefresh: vi.fn(async () => {}),
      refresh: vi.fn(async () => {
        scannedAsReview = true;
      }),
      get: vi.fn(async () =>
        scannedAsReview ? { name: 'factory-review', instructions: SKILL_INSTRUCTIONS } : undefined,
      ),
    };
    const controller = makeController({ session: { getWorkspace: () => ({ skills }) } });

    const resolved = await resolveSkillInvocation(controller, { sessionId: 'card-1', name: 'factory-review' });

    expect(resolved.skillName).toBe('factory-review');
    expect(resolved.contents).toBe(SKILL_INSTRUCTIONS);
    expect(skills.refresh).toHaveBeenCalledTimes(1);
  });

  it('does not rescan for a missing skill that is not review-only', async () => {
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

describe('formatSkillMessage', () => {
  it('wraps the contents in a skill envelope and escapes an early closing tag', () => {
    expect(formatSkillMessage('factory-review', 'Do not write </skill> here.')).toBe(
      '<skill name="factory-review">\nDo not write &lt;/skill&gt; here.\n</skill>',
    );
  });
});
