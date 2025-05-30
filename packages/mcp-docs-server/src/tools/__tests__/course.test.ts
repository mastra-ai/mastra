import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { callTool, mcp, server } from './test-setup';

let tools: any;

function getDeviceIdPath() {
  return path.join(os.homedir(), '.cache', 'mastra', '.device_id');
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
      test('should return course status with lesson info', async () => {
        const result = await callTool(tools.mastra_getMastraCourseStatus, {});
        expect(result.toLowerCase()).toContain('lesson');
      });
    });

    describe('nextMastraCourseStep', () => {
      test('should advance to the next step', async () => {
        const result = await callTool(tools.mastra_nextMastraCourseStep, {});
        expect(result.toLowerCase()).toMatch(/step|completed|lesson/i);
      });
    });

    describe('clearMastraCourseHistory', () => {
      test('should clear course history and confirm', async () => {
        const result = await callTool(tools.mastra_clearMastraCourseHistory, { confirm: true });
        expect(result.toLowerCase()).toContain('cleared');
      });
      test('should fail gracefully if progress is already cleared', async () => {
        const result = await callTool(tools.mastra_startMastraCourseLesson, { lessonName: 'NonExistentLesson' });
        expect(result.toLowerCase()).toMatch(/no course progress|start the course/i);
      });
    });

    describe('error handling', () => {
      test('should handle missing required arguments with an error', async () => {
        const result = await callTool(tools.mastra_startMastraCourseLesson, {});
        expect(result.toLowerCase()).toContain('invalid');
      });
    });
  });
});
