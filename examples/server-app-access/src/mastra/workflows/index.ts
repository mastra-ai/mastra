import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// --- Process Message Workflow ---

const validateStep = createStep({
  id: 'validate',
  description: 'Validates the incoming message',
  inputSchema: z.object({
    message: z.string(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    message: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
  }),
  execute: async ({ inputData }) => {
    const valid = inputData.message.length > 0 && inputData.message.length < 1000;
    return {
      valid,
      message: inputData.message,
      priority: inputData.priority,
    };
  },
});

const processStep = createStep({
  id: 'process',
  description: 'Processes the validated message',
  inputSchema: z.object({
    valid: z.boolean(),
    message: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
  }),
  outputSchema: z.object({
    processed: z.boolean(),
    result: z.string(),
    timestamp: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.valid) {
      return {
        processed: false,
        result: 'Invalid message',
        timestamp: new Date().toISOString(),
      };
    }

    const result = `Processed [${inputData.priority}]: ${inputData.message.substring(0, 50)}...`;

    return {
      processed: true,
      result,
      timestamp: new Date().toISOString(),
    };
  },
});

export const processMessageWorkflow = createWorkflow({
  id: 'process-message',
  description: 'Validates and processes a message',
  inputSchema: z.object({
    message: z.string(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
  }),
  outputSchema: z.object({
    processed: z.boolean(),
    result: z.string(),
    timestamp: z.string(),
  }),
})
  .then(validateStep)
  .then(processStep)
  .commit();

// --- Daily Report Workflow ---

const generateReportStep = createStep({
  id: 'generate-report',
  description: 'Generates a daily report',
  inputSchema: z.object({
    date: z.string(),
    reportType: z.enum(['summary', 'detailed']).default('summary'),
  }),
  outputSchema: z.object({
    reportId: z.string(),
    status: z.string(),
    generatedAt: z.string(),
  }),
  execute: async ({ inputData }) => {
    const reportId = `RPT-${Date.now()}`;

    return {
      reportId,
      status: `Generated ${inputData.reportType} report for ${inputData.date}`,
      generatedAt: new Date().toISOString(),
    };
  },
});

export const dailyReportWorkflow = createWorkflow({
  id: 'daily-report',
  description: 'Generates daily reports',
  inputSchema: z.object({
    date: z.string(),
    reportType: z.enum(['summary', 'detailed']).default('summary'),
  }),
  outputSchema: z.object({
    reportId: z.string(),
    status: z.string(),
    generatedAt: z.string(),
  }),
})
  .then(generateReportStep)
  .commit();

// --- Payment Processor Workflow ---

const processPaymentStep = createStep({
  id: 'process-payment',
  description: 'Processes a payment transaction',
  inputSchema: z.object({
    amount: z.number(),
    currency: z.string(),
    customerId: z.string(),
  }),
  outputSchema: z.object({
    transactionId: z.string(),
    status: z.string(),
    processedAt: z.string(),
  }),
  execute: async ({ inputData }) => {
    const transactionId = `TXN-${Date.now()}`;

    return {
      transactionId,
      status: `Processed ${inputData.currency} ${inputData.amount} for customer ${inputData.customerId}`,
      processedAt: new Date().toISOString(),
    };
  },
});

export const paymentProcessorWorkflow = createWorkflow({
  id: 'payment-processor',
  description: 'Processes payment transactions',
  inputSchema: z.object({
    amount: z.number(),
    currency: z.string(),
    customerId: z.string(),
  }),
  outputSchema: z.object({
    transactionId: z.string(),
    status: z.string(),
    processedAt: z.string(),
  }),
})
  .then(processPaymentStep)
  .commit();
