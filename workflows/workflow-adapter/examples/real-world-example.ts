/**
 * Real-world example: User onboarding workflow using Workflow steps with Mastra orchestration
 */

import { Mastra } from '@mastra/core';
import { createWorkflow, mapVariable } from '@mastra/core/workflows';
import { wrapWorkflowStep, wrapWorkflowSteps } from '../src/index';
import { z } from 'zod';

// ============================================================================
// Simulating compiled Workflow steps
// (In reality, these would be in .compiled/ directory after SWC transformation)
// ============================================================================

// User management steps
async function createUserInDatabase(email: string, name: string) {
  // Original: 'use step' directive removed by compiler
  console.log(`Creating user: ${name} (${email})`);
  
  // Simulate API call
  const userId = `user_${Date.now()}`;
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    id: userId,
    email,
    name,
    createdAt: new Date().toISOString(),
  };
}

async function verifyEmail(email: string) {
  console.log(`Sending verification email to: ${email}`);
  
  // Simulate email service
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return {
    sent: true,
    verificationToken: `token_${Date.now()}`,
  };
}

async function setupUserProfile(userId: string, preferences: any) {
  console.log(`Setting up profile for user: ${userId}`);
  
  // Simulate profile creation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    profileId: `profile_${userId}`,
    userId,
    preferences,
    createdAt: new Date().toISOString(),
  };
}

async function sendWelcomeEmail(email: string, name: string) {
  console.log(`Sending welcome email to: ${name} (${email})`);
  
  // Simulate email service
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return {
    sent: true,
    messageId: `msg_${Date.now()}`,
  };
}

async function notifySlack(message: string) {
  console.log(`Slack notification: ${message}`);
  
  // Simulate Slack webhook
  await new Promise(resolve => setTimeout(resolve, 30));
  
  return {
    sent: true,
    channel: '#onboarding',
  };
}

async function createInitialSubscription(userId: string, plan: string) {
  console.log(`Creating ${plan} subscription for user: ${userId}`);
  
  // Simulate subscription service
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    subscriptionId: `sub_${userId}`,
    plan,
    status: 'active',
    startDate: new Date().toISOString(),
  };
}

// ============================================================================
// Wrap compiled steps as Mastra steps
// ============================================================================

const createUserStep = wrapWorkflowStep({
  id: 'create-user',
  workflowStepFn: createUserInDatabase,
  inputSchema: z.object({ 
    email: z.string().email(), 
    name: z.string() 
  }),
  outputSchema: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    createdAt: z.string(),
  }),
  argsMapper: (input) => [input.email, input.name],
  description: 'Create user in database',
});

const verifyEmailStep = wrapWorkflowStep({
  id: 'verify-email',
  workflowStepFn: verifyEmail,
  inputSchema: z.object({ email: z.string().email() }),
  outputSchema: z.object({
    sent: z.boolean(),
    verificationToken: z.string(),
  }),
  argsMapper: (input) => [input.email],
  description: 'Send email verification',
});

const setupProfileStep = wrapWorkflowStep({
  id: 'setup-profile',
  workflowStepFn: setupUserProfile,
  inputSchema: z.object({
    userId: z.string(),
    preferences: z.object({
      theme: z.enum(['light', 'dark']),
      notifications: z.boolean(),
    }),
  }),
  outputSchema: z.object({
    profileId: z.string(),
    userId: z.string(),
    preferences: z.any(),
    createdAt: z.string(),
  }),
  argsMapper: (input) => [input.userId, input.preferences],
  description: 'Setup user profile with preferences',
});

const welcomeEmailStep = wrapWorkflowStep({
  id: 'welcome-email',
  workflowStepFn: sendWelcomeEmail,
  inputSchema: z.object({ 
    email: z.string().email(), 
    name: z.string() 
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    messageId: z.string(),
  }),
  argsMapper: (input) => [input.email, input.name],
  description: 'Send welcome email',
});

const slackNotificationStep = wrapWorkflowStep({
  id: 'slack-notification',
  workflowStepFn: notifySlack,
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({
    sent: z.boolean(),
    channel: z.string(),
  }),
  argsMapper: (input) => [input.message],
  description: 'Send Slack notification',
});

const subscriptionStep = wrapWorkflowStep({
  id: 'create-subscription',
  workflowStepFn: createInitialSubscription,
  inputSchema: z.object({
    userId: z.string(),
    plan: z.string(),
  }),
  outputSchema: z.object({
    subscriptionId: z.string(),
    plan: z.string(),
    status: z.string(),
    startDate: z.string(),
  }),
  argsMapper: (input) => [input.userId, input.plan],
  description: 'Create initial subscription',
});

// ============================================================================
// Build comprehensive onboarding workflow with Mastra orchestration
// ============================================================================

const userOnboardingWorkflow = createWorkflow({
  id: 'user-onboarding',
  inputSchema: z.object({
    email: z.string().email(),
    name: z.string(),
    plan: z.enum(['free', 'pro', 'enterprise']),
    preferences: z.object({
      theme: z.enum(['light', 'dark']),
      notifications: z.boolean(),
    }).optional(),
  }),
  outputSchema: z.object({
    userId: z.string(),
    profileId: z.string(),
    subscriptionId: z.string(),
    emailVerificationSent: z.boolean(),
    welcomeEmailSent: z.boolean(),
    slackNotified: z.boolean(),
  }),
})
  // Step 1: Create the user account
  .then(createUserStep)
  
  // Step 2: Run multiple tasks in parallel
  // - Verify email
  // - Setup profile
  // - Create subscription
  .parallel([
    // Map input for verify email
    createWorkflow({
      id: 'verify-email-mapped',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .map(() => ({
        email: mapVariable({ 
          step: createUserStep, 
          path: 'email' 
        }),
      }))
      .then(verifyEmailStep)
      .commit(),
    
    // Map input for setup profile  
    createWorkflow({
      id: 'setup-profile-mapped',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .map((ctx) => ({
        userId: mapVariable({ 
          step: createUserStep, 
          path: 'id' 
        }),
        preferences: ctx.getInitData().preferences || {
          theme: 'light',
          notifications: true,
        },
      }))
      .then(setupProfileStep)
      .commit(),
    
    // Map input for subscription
    createWorkflow({
      id: 'subscription-mapped',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .map((ctx) => ({
        userId: mapVariable({ 
          step: createUserStep, 
          path: 'id' 
        }),
        plan: ctx.getInitData().plan,
      }))
      .then(subscriptionStep)
      .commit(),
  ])
  
  // Step 3: Send notifications in parallel
  .parallel([
    // Send welcome email
    createWorkflow({
      id: 'welcome-email-mapped',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .map(() => ({
        email: mapVariable({ 
          step: createUserStep, 
          path: 'email' 
        }),
        name: mapVariable({ 
          step: createUserStep, 
          path: 'name' 
        }),
      }))
      .then(welcomeEmailStep)
      .commit(),
    
    // Notify team on Slack
    createWorkflow({
      id: 'slack-mapped',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .map(() => ({
        message: `New user signed up: ${mapVariable({ 
          step: createUserStep, 
          path: 'name' 
        })} (${mapVariable({ 
          step: createUserStep, 
          path: 'email' 
        })})`,
      }))
      .then(slackNotificationStep)
      .commit(),
  ])
  
  .commit();

// ============================================================================
// Execute the workflow
// ============================================================================

async function main() {
  console.log('=== User Onboarding Workflow ===\n');
  
  const mastra = new Mastra({
    workflows: {
      userOnboardingWorkflow,
    },
  });

  // Scenario 1: Free plan user
  console.log('Scenario 1: Free plan user');
  const freeRun = await userOnboardingWorkflow.createRunAsync();
  const freeResult = await freeRun.start({
    inputData: {
      email: 'john@example.com',
      name: 'John Doe',
      plan: 'free',
      preferences: {
        theme: 'dark',
        notifications: true,
      },
    },
  });
  
  console.log('\nResult:', JSON.stringify(freeResult, null, 2));
  
  // Scenario 2: Pro plan user with defaults
  console.log('\n\nScenario 2: Pro plan user with default preferences');
  const proRun = await userOnboardingWorkflow.createRunAsync();
  const proResult = await proRun.start({
    inputData: {
      email: 'jane@example.com',
      name: 'Jane Smith',
      plan: 'pro',
      // preferences omitted - will use defaults
    },
  });
  
  console.log('\nResult:', JSON.stringify(proResult, null, 2));
  
  console.log('\n=== Workflow completed successfully! ===');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

// ============================================================================
// This example demonstrates:
// ============================================================================
// 
// 1. ✅ Writing steps with Workflow's clean syntax
// 2. ✅ Compiling to plain async functions (step mode)
// 3. ✅ Wrapping as Mastra steps with schemas
// 4. ✅ Using Mastra's parallel execution
// 5. ✅ Using Mastra's mapping/data flow
// 6. ✅ Complex multi-step orchestration
// 7. ✅ Type-safe workflow construction
//
// Benefits shown:
// - Workflow steps are clean, focused functions
// - Mastra handles complex orchestration
// - Parallel execution for performance
// - Type safety throughout
// - Easy to test and maintain
