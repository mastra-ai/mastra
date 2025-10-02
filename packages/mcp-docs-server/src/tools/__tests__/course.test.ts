import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, test, beforeAll, afterAll, afterEach } from 'vitest';
import { callTool, mcp, server } from './test-setup';

let tools: any;

function getDeviceIdPath() {
  return path.join(os.homedir(), '.cache', 'mastra', '.device_id');
}

function completeCourses({
  lastLessonStatus = 1,
  lastStepStatus = 1,
}: {
  lastLessonStatus?: number;
  lastStepStatus?: number;
}) {
  const statePath = path.join(os.homedir(), '.cache', 'mastra', 'course', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  state.lessons.forEach((lesson: any) => {
    lesson.status = 2;
    lesson.steps.forEach((step: any) => {
      step.status = 2;
    });
  });
  // Set last step of last lesson to in-progress (status = 1)
  const lastLesson = state.lessons[state.lessons.length - 1];
  lastLesson.status = lastLessonStatus;
  lastLesson.steps[lastLesson.steps.length - 1].status = lastStepStatus;
  state.currentLesson = lastLesson.name;
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

describe('Course Tools', () => {
  beforeAll(async () => {
    tools = await mcp.getTools(); // <-- must be after the mock!
  });

  afterAll(async () => {
    server.close();
    await mcp.disconnect();
  });

  describe('Course Tools - Registration Required', () => {
    beforeAll(() => {
      // Remove the .device_id file to simulate unregistered state
      const deviceIdPath = getDeviceIdPath();
      if (fs.existsSync(deviceIdPath)) {
        fs.unlinkSync(deviceIdPath);
      }
    });

    test('should prompt for registration if not registered', async () => {
      const result = await callTool(tools.mastra_startMastraCourse, {});
      expect(result).toMatch(/provide your email address/i);
    });

    test('should block status if not registered', async () => {
      const result = await callTool(tools.mastra_getMastraCourseStatus, {});
      expect(result).toMatch(/register for the Mastra Course/i);
    });

    test('should block lesson start if not registered', async () => {
      const result = await callTool(tools.mastra_startMastraCourseLesson, { lessonName: 'Introduction' });
      expect(result).toMatch(/register for the Mastra Course/i);
    });

    test('should block course history clear if not registered', async () => {
      const result = await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
      expect(result).toMatch(/register for the Mastra Course/i);
    });
  });

  describe('Course Tools - Registered User', () => {
    beforeAll(async () => {
      await callTool(tools.mastra_startMastraCourse, { email: 'testuser@example.com' });
    });

    describe('startMastraCourse', () => {
      beforeAll(async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
        await callTool(tools.mastra_startMastraCourse, { email: 'testuser@example.com' });
      });

      afterAll(async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
      });

      test('should return the first lesson/step prompt', async () => {
        const result = await callTool(tools.mastra_startMastraCourse, {});
        expect(result).toContain('📘 Lesson: first-agent');
        expect(result).toContain('Step: introduction-to-mastra');
      });

      test('should resume the current lesson and show lesson message', async () => {
        // Advance to the next step so the lesson is now in progress
        await callTool(tools.mastra_nextMastraCourseStep, {});
        const result = await callTool(tools.mastra_startMastraCourse, {});
        expect(result).toContain('📘 Lesson: first-agent');
        expect(result).toMatch(/step/i);
      });

      test('should handle invalid email', async () => {
        const result = await callTool(tools.mastra_startMastraCourse, { email: 'invalid_email' });
        expect(result.toLowerCase()).toContain('invalid email');
      });

      test('should handle already registered', async () => {
        const result = await callTool(tools.mastra_startMastraCourse, { email: 'testuser@example.com' });
        expect(result).toContain('📘 Lesson: first-agent');
        expect(result).toMatch(/step/i);
      });

      test('should handle calling without email when already registered', async () => {
        const result = await callTool(tools.mastra_startMastraCourse, {});
        expect(result).toContain('📘 Lesson: first-agent');
        expect(result).toMatch(/step/i);
      });
    });

    describe('startMastraCourseLesson', () => {
      beforeAll(async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
        await callTool(tools.mastra_startMastraCourse, { email: 'testuser@example.com' });
      });

      test('should start a new lesson and show starting step info', async () => {
        const result = await callTool(tools.mastra_startMastraCourseLesson, { lessonName: 'first-agent' });
        expect(result).toContain('📘 Starting Lesson: first-agent');
        expect(result).toMatch(/step/i);
      });

      test('should always show starting lesson message for in-progress lesson', async () => {
        // Advance to the next step so the lesson is now in progress
        await callTool(tools.mastra_nextMastraCourseStep, {});
        const result = await callTool(tools.mastra_startMastraCourseLesson, { lessonName: 'first-agent' });
        expect(result).toContain('📘 Starting Lesson: first-agent');
        expect(result).toMatch(/step/i);
      });

      test('should handle invalid lesson names gracefully', async () => {
        const result = await callTool(tools.mastra_startMastraCourseLesson, { lessonName: 'NonExistentLesson' });
        expect(result.toLowerCase()).toContain('not found');
      });
    });

    describe('getMastraCourseStatus', () => {
      beforeAll(async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
      });

      afterAll(async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
      });

      test('should return course status with lesson info', async () => {
        await callTool(tools.mastra_startMastraCourse, { email: 'testuser@example.com' });
        const result = await callTool(tools.mastra_getMastraCourseStatus, {});
        expect(result.toLowerCase()).toContain('lesson');
      });

      test('should show no course progress if registered but no progress', async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
        await callTool(tools.mastra_startMastraCourse, { email: 'testuser@example.com' });
        // Delete progress file or simulate no progress
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
        const result = await callTool(tools.mastra_getMastraCourseStatus, {});
        expect(result.toLowerCase()).toContain('no course progress found');
      });

      test('should indicate all lessons completed in status after course completion', async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
        await callTool(tools.mastra_startMastraCourse, { email: 'testuser@example.com' });
        completeCourses({
          lastLessonStatus: 2,
          lastStepStatus: 2,
        });
        const statusResult = await callTool(tools.mastra_getMastraCourseStatus, {});
        expect(statusResult).toMatch(/lessons:\s*\d+\/\d+\s*completed\s*\(100%\)/i);
        expect(statusResult).toMatch(/✅/);
      });
    });

    describe('nextMastraCourseStep', () => {
      beforeAll(async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
      });
      afterAll(async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
      });
      test('should advance to the next step', async () => {
        await callTool(tools.mastra_startMastraCourse, { email: 'testuser@example.com' });
        const result = await callTool(tools.mastra_nextMastraCourseStep, {});
        expect(result.toLowerCase()).toMatch(/step|completed|lesson/i);
      });

      test('should handle no progress found', async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
        const result = await callTool(tools.mastra_nextMastraCourseStep, {});
        expect(result.toLowerCase()).toMatch(/no course progress|start the course/i);
      });

      test('nextMastraCourseStep should return congratulations message when all lessons complete', async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
        await callTool(tools.mastra_startMastraCourse, { email: 'testuser@example.com' });
        completeCourses({
          lastLessonStatus: 1,
          lastStepStatus: 1,
        });
        const result = await callTool(tools.mastra_nextMastraCourseStep, {});
        expect(result.toLowerCase()).toMatch(/congratulations! you'?ve completed all available lessons/);
        const statusResult = await callTool(tools.mastra_getMastraCourseStatus, {});
        expect(statusResult).toMatch(/lessons:\s*\d+\/\d+\s*completed\s*\(100%\)/i);
        expect(statusResult).toMatch(/✅/);
      });
    });

    describe('clearMastraCourseHistory', () => {
      test('should clear course history and confirm', async () => {
        await callTool(tools.mastra_startMastraCourse, { email: 'testuser@example.com' });
        const result = await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
        expect(result.toLowerCase()).toContain('cleared');
      });
      test('should fail gracefully if progress is already cleared', async () => {
        const result = await callTool(tools.mastra_startMastraCourseLesson, { lessonName: 'NonExistentLesson' });
        expect(result.toLowerCase()).toMatch(/no course progress|start the course/i);
      });
    });

    describe('error handling', () => {
      afterEach(async () => {
        await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
      });

      test('should handle missing required arguments with an error', async () => {
        const result = await callTool(tools.mastra_startMastraCourseLesson, {});
        expect(result.toLowerCase()).toContain('tool validation failed');
      });
      test('should handle corrupted state file gracefully', async () => {
        const statePath = path.join(os.homedir(), '.cache', 'mastra', 'course', 'state.json');
        fs.writeFileSync(statePath, '{invalidJson:', 'utf-8');
        const result = await callTool(tools.mastra_getMastraCourseStatus, {});
        expect(result.toLowerCase()).toContain('failed to load course state');
      });
    });
  });
});
