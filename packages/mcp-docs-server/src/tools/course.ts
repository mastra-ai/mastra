import { existsSync, mkdirSync } from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { fromPackageRoot } from '../utils';

// Prefix with underscore since it's only used as a type
const _courseLessonSchema = z.object({
  lessonName: z.string().describe('Name of the specific lesson to start. It must match the exact lesson name.'),
});

const _confirmationSchema = z.object({
  confirm: z.boolean().optional().describe('Set to true to confirm this action'),
});

// Define the CourseState type directly
type CourseState = {
  currentLesson: string;
  lessons: Array<{
    name: string;
    status: number; // 0 = not started, 1 = in progress, 2 = completed
    steps: Array<{
      name: string;
      status: number; // 0 = not started, 1 = in progress, 2 = completed
    }>;
  }>;
};

const courseDir = fromPackageRoot('.docs/raw/course');

// Define the introduction prompt shown only when a user registers for the course
const introductionPrompt = `
This is a course to help a new user learn about Mastra, the open-source AI Agent framework built in Typescript.
The following is the introduction content, please provide this text to the user EXACTLY as written below. Do not provide any other text or instructions:

# Welcome to the Mastra Course!

Thank you for registering for the Mastra course! This interactive guide will help you learn how to build powerful AI agents with Mastra, the open-source AI Agent framework built in TypeScript.

## Before We Begin

If you enjoy Mastra, please consider starring the GitHub repository:
https://github.com/mastra-ai/mastra

This helps the project grow and reach more developers like you!

## How This Course Works

- Each lesson is broken into multiple steps
- I'll guide you through the code examples and explanations
- You can ask questions at any time
- If you ever leave and come back, use the \`startMastraCourse\` tool to pick up where you left off. Just ask to "start the Mastra course".
- Use the \`nextMastraCourseStep\` tool to move to the next step when you're ready. Just ask to "move to the next step" when you are ready.
- Use the \`getMastraCourseStatus\` tool to check your progress. You can just ask "get my course progress".
- Use the \`clearMastraCourseHistory\` tool to reset your progress and start over. You can just ask "clear my course progress".

Type "start mastra course" and let's get started with your first lesson!
`;

// Define the prompt that wraps each lesson step
const lessonPrompt = `
  This is a course to help a new user learn about Mastra, the open-source AI Agent framework built in Typescript.
  Please help the user through the steps of the course by walking them through the content and following the course
  to write the initial version of the code for them. The goal is to show them how the code works and explain it as they go
  as the course goes on. Each lesson is broken up into steps. You should return the content of the step and ask the user
  to move to the next step when they are ready. If the step contains instructions to write code, you should write the code
  for the user when possible. You should always briefly explain the step before writing the code. Please ensure to 
  return any text in markdown blockquotes exactly as written in your response. When the user ask about their course progress or course status,
  make sure to include the course status url in your response. This is important.
`;

// Define the prompt wrapper for each course step
function wrapContentInPrompt(content: string, _isFirstStep: boolean = false): string {
  let wrappedContent = `${lessonPrompt}\n\nHere is the content for this step: <StepContent>${content}</StepContent>`;
  return `${wrappedContent}\n\nWhen you're ready to continue, use the \`nextMastraCourseStep\` tool to move to the next step.`;
}

// Get the path to the device ID file
async function getDeviceIdPath(): Promise<string> {
  const cacheDir = path.join(os.homedir(), '.cache', 'mastra');

  // Create the directory if it doesn't exist
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  return path.join(cacheDir, '.device_id');
}

// Get the device credentials (deviceId and key) if the user is registered
async function getDeviceCredentials(): Promise<{ deviceId: string; key: string } | null> {
  try {
    const deviceIdPath = await getDeviceIdPath();
    if (!existsSync(deviceIdPath)) {
      return null;
    }
    const fileContent = await fs.readFile(deviceIdPath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    if (typeof parsed.deviceId === 'string' && typeof parsed.key === 'string') {
      return { deviceId: parsed.deviceId, key: parsed.key };
    }
    return null;
  } catch {
    return null;
  }
}

async function getDeviceId(): Promise<string | null> {
  const creds = await getDeviceCredentials();

  if (!creds || !creds?.deviceId) {
    return null;
  }

  return creds.deviceId;
}

// Save the device credentials (deviceId and key)
async function saveDeviceCredentials(deviceId: string, key: string): Promise<void> {
  const deviceIdPath = await getDeviceIdPath();
  const toWrite = JSON.stringify({ deviceId, key });
  await fs.writeFile(deviceIdPath, toWrite, 'utf-8');
  // Set file permissions to 600 (read/write for owner only)
  await fs.chmod(deviceIdPath, 0o600);
}

// Make an HTTP request to register the user
export function registerUserLocally(
  email: string,
): Promise<{ success: boolean; id: string; key: string; message: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email,
    });
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/course/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };
    const req = http.request(options, res => {
      let responseData = '';
      res.on('data', chunk => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });
    req.on('error', error => {
      reject(error);
    });
    req.write(data);
    req.end();
  });
}

async function registerUser(email: string): Promise<{ success: boolean; id: string; key: string; message: string }> {
  const response = await fetch('https://mastra.ai/api/course/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(`Registration failed with status ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function readCourseStep(lessonName: string, stepName: string, _isFirstStep: boolean = false): Promise<string> {
  // Find the lesson directory that matches the name
  const lessonDirs = await fs.readdir(courseDir);
  const lessonDir = lessonDirs.find(dir => dir.replace(/^\d+-/, '') === lessonName);

  if (!lessonDir) {
    throw new Error(`Lesson "${lessonName}" not found.`);
  }

  // Find the step file that matches the name
  const lessonPath = path.join(courseDir, lessonDir);
  const files = await fs.readdir(lessonPath);
  const stepFile = files.find(f => f.endsWith('.md') && f.replace(/^\d+-/, '').replace('.md', '') === stepName);

  if (!stepFile) {
    throw new Error(`Step "${stepName}" not found in lesson "${lessonName}".`);
  }

  const filePath = path.join(courseDir, lessonDir, stepFile);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return wrapContentInPrompt(content);
  } catch (error) {
    throw new Error(`Failed to read step "${stepName}" in lesson "${lessonName}": ${error}`);
  }
}

// Create a function to update course state on the local server
export function updateCourseStateOnServerLocally(deviceId: string, state: CourseState): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const creds = await getDeviceCredentials();
      if (!creds) {
        return reject(new Error('Device credentials not found.'));
      }
      const data = JSON.stringify({
        id: creds.deviceId,
        state: state,
      });
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/course/update',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'x-mastra-course-key': creds.key,
        },
      };
      const req = http.request(options, res => {
        let responseData = '';
        res.on('data', chunk => {
          responseData += chunk;
        });
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`Server returned status code ${res.statusCode}: ${responseData}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        });
      });
      req.on('error', error => {
        reject(error);
      });
      req.write(data);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Create a function to update course state on the server
async function updateCourseStateOnServer(deviceId: string, state: CourseState): Promise<void> {
  const creds = await getDeviceCredentials();
  if (!creds) {
    throw new Error('Device credentials not found.');
  }

  const response = await fetch('https://mastra.ai/api/course/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mastra-course-key': creds.key,
    },
    body: JSON.stringify({
      id: creds.deviceId,
      state: state,
    }),
  });

  if (!response.ok) {
    throw new Error(`Course state update failed with status ${response.status}: ${response.statusText}`);
  }
}

async function saveCourseState(state: CourseState, deviceId: string | null): Promise<void> {
  // If no device ID, the user isn't registered - this is an error condition
  if (!deviceId) {
    throw new Error('Cannot save course state: User is not registered');
  }
  const statePath = await getCourseStatePath();
  try {
    // Save to local filesystem
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
    // Sync with server
    try {
      // Use getDeviceCredentials to ensure we have the key
      const creds = await getDeviceCredentials();
      if (!creds) throw new Error('Device credentials not found');
      await updateCourseStateOnServer(creds.deviceId, state);
    } catch {
      // Silently continue if server sync fails
      // Local save is still successful
    }
  } catch (error) {
    throw new Error(`Failed to save course state: ${error}`);
  }
}

// Get the path to the course state file
async function getCourseStatePath(): Promise<string> {
  const stateDirPath = path.join(os.homedir(), '.cache', 'mastra', 'course');

  // Ensure the directory exists
  if (!existsSync(stateDirPath)) {
    mkdirSync(stateDirPath, { recursive: true });
  }

  return path.join(stateDirPath, 'state.json');
}

async function loadCourseState(): Promise<CourseState | null> {
  const statePath = await getCourseStatePath();

  try {
    if (existsSync(statePath)) {
      const stateData = await fs.readFile(statePath, 'utf-8');
      return JSON.parse(stateData) as CourseState;
    }
  } catch (error) {
    throw new Error(`Failed to load course state: ${error}`);
  }

  return null;
}

async function scanCourseContent(): Promise<CourseState> {
  // Scan the course directory to build a fresh state
  const lessonDirs = await fs.readdir(courseDir);

  const lessons = await Promise.all(
    lessonDirs
      .filter(dir => !dir.startsWith('.')) // Skip hidden directories
      .sort((a, b) => a.localeCompare(b))
      .map(async lessonDir => {
        const lessonPath = path.join(courseDir, lessonDir);
        const lessonStats = await fs.stat(lessonPath);

        if (!lessonStats.isDirectory()) return null;

        // Extract lesson name from directory (remove numbering prefix)
        const lessonName = lessonDir.replace(/^\d+-/, '');

        // Get all markdown files in the lesson directory
        const stepFiles = (await fs.readdir(lessonPath))
          .filter(file => file.endsWith('.md'))
          .sort((a, b) => a.localeCompare(b));

        // Build steps array
        const steps = await Promise.all(
          stepFiles.map(async file => {
            // Extract step name from filename (remove numbering prefix)
            const stepName = file.replace(/^\d+-/, '').replace('.md', '');

            return {
              name: stepName,
              status: 0, // Default: not started
            };
          }),
        );

        return {
          name: lessonName,
          status: 0, // Default: not started
          steps: steps.filter(Boolean),
        };
      }),
  );

  // Filter out null values and create the state
  const validLessons = lessons.filter((lesson): lesson is NonNullable<typeof lesson> => lesson !== null);

  return {
    currentLesson: validLessons.length > 0 ? validLessons[0].name : '',
    lessons: validLessons,
  };
}

async function mergeCourseStates(currentState: CourseState, newState: CourseState): Promise<CourseState> {
  // Create a map of existing lessons by name for easy lookup
  const existingLessonMap = new Map(currentState.lessons.map(lesson => [lesson.name, lesson]));

  // Merge the states, preserving progress where possible
  const mergedLessons = newState.lessons.map(newLesson => {
    const existingLesson = existingLessonMap.get(newLesson.name);

    if (!existingLesson) {
      // This is a new lesson
      return newLesson;
    }

    // Create a map of existing steps by name
    const existingStepMap = new Map(existingLesson.steps.map(step => [step.name, step]));

    // Merge steps, preserving progress for existing steps
    const mergedSteps = newLesson.steps.map(newStep => {
      const existingStep = existingStepMap.get(newStep.name);

      if (existingStep) {
        // Preserve the status from the existing step
        return {
          ...newStep,
          status: existingStep.status,
        };
      }

      return newStep;
    });

    // Calculate lesson status based on steps
    let lessonStatus = existingLesson.status;
    if (mergedSteps.every(step => step.status === 2)) {
      lessonStatus = 2; // Completed
    } else if (mergedSteps.some(step => step.status > 0)) {
      lessonStatus = 1; // In progress
    }

    return {
      ...newLesson,
      status: lessonStatus,
      steps: mergedSteps,
    };
  });

  // Determine current lesson
  let currentLesson = currentState.currentLesson;

  // If the current lesson doesn't exist in the new state, reset to the first lesson
  if (!mergedLessons.some(lesson => lesson.name === currentLesson) && mergedLessons.length > 0) {
    currentLesson = mergedLessons[0].name;
  }

  return {
    currentLesson,
    lessons: mergedLessons,
  };
}

export const startMastraCourse = {
  name: 'startMastraCourse',
  description:
    'Starts the Mastra Course. If the user is not registered, they will be prompted to register first. Otherwise, it will start at the first lesson or pick up where they last left off. ALWAYS ask the user for their email address if they are not registered. DO NOT assume their email address, they must confirm their email and that they want to register.',
  parameters: z.object({
    email: z.string().email().optional().describe('Email address for registration if not already registered. '),
  }),
  execute: async (args: { email?: string }) => {
    try {
      // Check if the user is registered
      const creds = await getDeviceCredentials();
      const registered = creds !== null;
      let deviceId = creds?.deviceId ?? null;
      if (!registered) {
        // If not registered and no email provided, prompt for email
        if (!args.email) {
          return 'To start the Mastra Course, you need to register first. Please provide your email address by calling this tool again with the email parameter.';
        }

        // User provided email, register them
        try {
          const response = await registerUser(args.email);

          if (response.success) {
            // Save both deviceId and key
            await saveDeviceCredentials(response.id, response.key);
            deviceId = response.id;
          } else {
            return `Registration failed: ${response.message}. Please try again with a valid email address.`;
          }
        } catch (error) {
          return `Failed to register: ${error instanceof Error ? error.message : String(error)}. Please try again later.`;
        }
      }

      // Try to load the user's course progress
      let courseState = await loadCourseState();
      let statusMessage = '';

      // Get the latest course content structure
      const latestCourseState = await scanCourseContent();

      if (!latestCourseState.lessons.length) {
        return 'No course content found. Please make sure the course content is properly set up in the .docs/course/lessons directory.';
      }

      if (courseState) {
        // User has existing progress, merge with latest content
        const previousState = JSON.parse(JSON.stringify(courseState)) as CourseState; // Deep clone for comparison
        courseState = await mergeCourseStates(courseState, latestCourseState);

        // Check if there are differences in the course structure
        const newLessons = latestCourseState.lessons.filter(
          newLesson => !previousState.lessons.some((oldLesson: { name: string }) => oldLesson.name === newLesson.name),
        );

        if (newLessons.length > 0) {
          statusMessage = `📚 Course content has been updated! ${newLessons.length} new lesson(s) have been added:\n`;
          statusMessage += newLessons.map(lesson => `- ${lesson.name}`).join('\n');
          statusMessage += '\n\n';
        }

        // Save the merged state
        await saveCourseState(courseState, deviceId);
      } else {
        // First time user, create new state
        courseState = latestCourseState;
        await saveCourseState(courseState, deviceId);

        // Check if this is a new registration
        if (!registered && args.email) {
          // Just return the introduction prompt.
          return introductionPrompt;
        }
      }

      // Find the current lesson and step
      const currentLessonName = courseState.currentLesson;
      const currentLesson = courseState.lessons.find(lesson => lesson.name === currentLessonName);

      if (!currentLesson) {
        return 'Error: Current lesson not found in course content. Please try again or reset your course progress.';
      }

      // Find the first incomplete step in the current lesson
      const currentStep = currentLesson.steps.find(step => step.status !== 2);

      if (!currentStep && currentLesson.status !== 2) {
        // Mark the lesson as completed if all steps are done
        currentLesson.status = 2;
        await saveCourseState(courseState, deviceId);

        // Find the next lesson that's not completed
        const nextLesson = courseState.lessons.find(lesson => lesson.status !== 2 && lesson.name !== currentLessonName);

        if (nextLesson) {
          courseState.currentLesson = nextLesson.name;
          await saveCourseState(courseState, deviceId);

          return `${statusMessage}🎉 You've completed the "${currentLessonName}" lesson!\n\nMoving on to the next lesson: "${nextLesson.name}".\n\nUse the \`nextMastraCourseStep\` tool to start the first step of this lesson.`;
        } else {
          return `${statusMessage}🎉 Congratulations! You've completed all available lessons in the Mastra Course!\n\nIf you'd like to review any lesson, use the \`startMastraCourseLesson\` tool with the lesson name.`;
        }
      }

      if (!currentStep) {
        // This should not happen, but just in case
        return `${statusMessage}Error: No incomplete steps found in the current lesson. Please try another lesson or reset your course progress.`;
      }

      // Mark the step as in progress
      currentStep.status = 1;

      // If the lesson is not in progress, mark it as in progress
      if (currentLesson.status === 0) {
        currentLesson.status = 1;
      }

      // Save the updated state
      await saveCourseState(courseState, deviceId);

      // Get the content for the current step
      const stepContent = await readCourseStep(currentLessonName, currentStep.name);

      return `📘 Lesson: ${currentLessonName}\n📝 Step: ${currentStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
    } catch (error) {
      return `Error starting the Mastra course: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

export const getMastraCourseStatus = {
  name: 'getMastraCourseStatus',
  description: 'Gets the current status of the Mastra Course, including which lessons and steps have been completed',
  parameters: z.object({}),
  execute: async (_args: Record<string, never>) => {
    try {
      // Check if the user is registered
      const deviceId = await getDeviceId();

      if (deviceId === null) {
        return 'You need to register for the Mastra Course first. Please use the `startMastraCourse` tool to register.';
      }

      // Load the course state
      const courseState = await loadCourseState();

      if (!courseState) {
        return 'No course progress found. Please start the course first using the `startMastraCourse` tool.';
      }

      // Get the latest course content structure to ensure we have the most up-to-date information
      const latestCourseState = await scanCourseContent();

      if (!latestCourseState.lessons.length) {
        return 'No course content found. Please make sure the course content is properly set up in the .docs/course/lessons directory.';
      }

      // Merge the states to ensure we have the latest content with the user's progress
      const mergedState = await mergeCourseStates(courseState, latestCourseState);

      // Build a formatted status report
      let statusReport = '# Mastra Course Progress\n\n';

      // Add overall progress stats
      const totalLessons = mergedState.lessons.length;
      const completedLessons = mergedState.lessons.filter(lesson => lesson.status === 2).length;
      const _inProgressLessons = mergedState.lessons.filter(lesson => lesson.status === 1).length;

      const totalSteps = mergedState.lessons.reduce((sum, lesson) => sum + lesson.steps.length, 0);
      const completedSteps = mergedState.lessons.reduce(
        (sum, lesson) => sum + lesson.steps.filter(step => step.status === 2).length,
        0,
      );

      statusReport += `## Overall Progress\n`;
      statusReport += `- Course status Url: **https://mastra.ai/course/${deviceId}**\n`;
      statusReport += `- Current Lesson: **${mergedState.currentLesson}**\n`;
      statusReport += `- Lessons: ${completedLessons}/${totalLessons} completed (${Math.round((completedLessons / totalLessons) * 100)}%)\n`;
      statusReport += `- Steps: ${completedSteps}/${totalSteps} completed (${Math.round((completedSteps / totalSteps) * 100)}%)\n\n`;

      // Add detailed lesson status
      statusReport += `## Lesson Details\n\n`;

      mergedState.lessons.forEach((lesson, lessonIndex) => {
        // Determine lesson status icon
        let lessonStatusIcon = '⬜'; // Not started
        if (lesson.status === 1) lessonStatusIcon = '🔶'; // In progress
        if (lesson.status === 2) lessonStatusIcon = '✅'; // Completed

        // Highlight current lesson
        const isCurrent = lesson.name === mergedState.currentLesson;
        const lessonPrefix = isCurrent ? '👉 ' : '';

        statusReport += `### ${lessonPrefix}${lessonIndex + 1}. ${lessonStatusIcon} ${lesson.name}\n\n`;

        // Add step details
        lesson.steps.forEach((step, stepIndex) => {
          // Determine step status icon
          let stepStatusIcon = '⬜'; // Not started
          if (step.status === 1) stepStatusIcon = '🔶'; // In progress
          if (step.status === 2) stepStatusIcon = '✅'; // Completed

          statusReport += `- ${stepStatusIcon} Step ${stepIndex + 1}: ${step.name}\n`;
        });

        statusReport += '\n';
      });

      // Add navigation instructions
      statusReport += `## Navigation\n\n`;
      statusReport += `- To continue the course: \`nextMastraCourseStep\`\n`;
      statusReport += `- To start a specific lesson: \`startMastraCourseLesson\`\n`;
      statusReport += `- To reset progress: \`clearMastraCourseHistory\`\n`;

      return `Course Status: ${statusReport}\n\nCourse status url: https://mastra.ai/course/${deviceId}`;
    } catch (error) {
      return `Error getting course status: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

export const startMastraCourseLesson = {
  name: 'startMastraCourseLesson',
  description:
    'Starts a specific lesson in the Mastra Course. If the lesson has been started before, it will resume from the first incomplete step',
  parameters: _courseLessonSchema,
  execute: async (args: z.infer<typeof _courseLessonSchema>) => {
    try {
      // Check if the user is registered
      const deviceId = await getDeviceId();

      if (deviceId === null) {
        return 'You need to register for the Mastra Course first. Please use the `startMastraCourse` tool to register.';
      }

      // Load the current course state
      let courseState = await loadCourseState();

      if (!courseState) {
        return 'No course progress found. Please start the course first using the `startMastraCourse` tool.';
      }

      // Find the target lesson by name
      const targetLessonName = args.lessonName;

      // Find the target lesson
      const targetLesson = courseState.lessons.find(lesson => lesson.name === targetLessonName);

      if (!targetLesson) {
        const availableLessons = courseState.lessons.map((lesson, index) => `${index + 1}. ${lesson.name}`).join('\n');
        return `Lesson "${targetLessonName}" not found. Available lessons:\n${availableLessons}`;
      }

      // Update the current lesson in the state
      courseState.currentLesson = targetLesson.name;

      // Find the first incomplete step in the lesson, or the first step if all are completed
      const firstIncompleteStep = targetLesson.steps.find(step => step.status !== 2) || targetLesson.steps[0];

      if (!firstIncompleteStep) {
        return `The lesson "${targetLesson.name}" does not have any steps.`;
      }

      // Mark the step as in progress
      firstIncompleteStep.status = 1;

      // If the lesson is not in progress or completed, mark it as in progress
      if (targetLesson.status === 0) {
        targetLesson.status = 1;
      }

      // Save the updated state
      await saveCourseState(courseState, deviceId);

      // Get the content for the step
      const stepContent = await readCourseStep(targetLesson.name, firstIncompleteStep.name);

      return `📘 Starting Lesson: ${targetLesson.name}\n📝 Step: ${firstIncompleteStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
    } catch (error) {
      return `Error starting course lesson: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

export const nextMastraCourseStep = {
  name: 'nextMastraCourseStep',
  description:
    'Advances to the next step in the current Mastra Course lesson. If all steps in the current lesson are completed, it will move to the next lesson',
  parameters: z.object({}),
  execute: async (_args: Record<string, never>) => {
    try {
      // Check if the user is registered
      const deviceId = await getDeviceId();

      if (deviceId === null) {
        return 'You need to register for the Mastra Course first. Please use the `startMastraCourse` tool to register.';
      }

      // Load the current course state
      const courseState = await loadCourseState();

      if (!courseState) {
        return 'No course progress found. Please start the course first using the `startMastraCourse` tool.';
      }

      // Find the current lesson
      const currentLessonName = courseState.currentLesson;
      const currentLesson = courseState.lessons.find(lesson => lesson.name === currentLessonName);

      if (!currentLesson) {
        return 'Error: Current lesson not found in course content. Please try again or reset your course progress.';
      }

      // Find the current in-progress step
      const currentStepIndex = currentLesson.steps.findIndex(step => step.status === 1);

      if (currentStepIndex === -1) {
        return 'No step is currently in progress. Please start a step first using the `startMastraCourse` tool.';
      }

      // Mark the current step as completed
      currentLesson.steps[currentStepIndex].status = 2; // Completed

      // Find the next step in the current lesson
      const nextStepIndex = currentLesson.steps.findIndex(
        (step, index) => index > currentStepIndex && step.status !== 2,
      );

      // If there's a next step in the current lesson
      if (nextStepIndex !== -1) {
        // Mark the next step as in progress
        currentLesson.steps[nextStepIndex].status = 1; // In progress

        // Save the updated state
        await saveCourseState(courseState, deviceId);

        // Get the content for the next step
        const nextStep = currentLesson.steps[nextStepIndex];
        const stepContent = await readCourseStep(currentLessonName, nextStep.name);

        return `🎉 Step "${currentLesson.steps[currentStepIndex].name}" completed!\n\n📘 Continuing Lesson: ${currentLessonName}\n📝 Next Step: ${nextStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
      }

      // All steps in the current lesson are completed
      // Mark the lesson as completed
      currentLesson.status = 2; // Completed

      // Find the next lesson that's not completed
      const currentLessonIndex = courseState.lessons.findIndex(lesson => lesson.name === currentLessonName);
      const nextLesson = courseState.lessons.find((lesson, index) => index > currentLessonIndex && lesson.status !== 2);

      if (nextLesson) {
        // Update the current lesson to the next lesson
        courseState.currentLesson = nextLesson.name;

        // Mark the first step of the next lesson as in progress
        if (nextLesson.steps.length > 0) {
          nextLesson.steps[0].status = 1; // In progress
        }

        // Mark the next lesson as in progress
        nextLesson.status = 1; // In progress

        // Save the updated state
        await saveCourseState(courseState, deviceId);

        // Get the content for the first step of the next lesson
        const firstStep = nextLesson.steps[0];
        const stepContent = await readCourseStep(nextLesson.name, firstStep.name);

        return `🎉 Congratulations! You've completed the "${currentLessonName}" lesson!\n\n📘 Starting New Lesson: ${nextLesson.name}\n📝 First Step: ${firstStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
      }

      // All lessons are completed
      await saveCourseState(courseState, deviceId);

      return `🎉 Congratulations! You've completed all available lessons in the Mastra Course!\n\nIf you'd like to review any lesson, use the \`startMastraCourseLesson\` tool with the lesson name.`;
    } catch (error) {
      return `Error advancing to the next course step: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

export const clearMastraCourseHistory = {
  name: 'clearMastraCourseHistory',
  description:
    'Clears all Mastra Course progress history and starts over from the beginning. This action cannot be undone',
  parameters: _confirmationSchema,
  execute: async (args: z.infer<typeof _confirmationSchema>) => {
    try {
      // Check if the user is registered
      const deviceId = await getDeviceId();

      if (deviceId === null) {
        return 'You need to register for the Mastra Course first. Please use the `startMastraCourse` tool to register.';
      }

      // Check if the user has confirmed the action
      if (!args.confirm) {
        return '⚠️ This action will delete all your course progress and cannot be undone. To proceed, please run this tool again with the confirm parameter set to true.';
      }

      // Get the state file path
      const statePath = await getCourseStatePath();

      // Check if the state file exists
      if (!existsSync(statePath)) {
        return 'No course progress found. Nothing to clear.';
      }

      // Delete the state file
      await fs.unlink(statePath);

      return '🧹 Course progress has been cleared. You can restart the Mastra course from the beginning.';
    } catch (error) {
      return `Error clearing course history: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
