/**
 * Minimal example showing OpenTelemetry bridge with Express
 *
 * This demonstrates Scenario A: HTTP service receiving W3C trace context headers
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from parent examples directory
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

import express from 'express';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Observability } from '@mastra/observability';
import { OtelBridge, expressMiddleware } from '@mastra/otel-bridge';

// Create agent instance
const chatAgentDef = new Agent({
  name: 'chat-agent',
  instructions: 'You are a helpful assistant. Keep responses brief.',
  model: 'openai/gpt-4o-mini',
});

// Configure Mastra with OtelBridge
const mastra = new Mastra({
  agents: { chatAgent: chatAgentDef },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'otel-bridge-example',
        bridge: new OtelBridge({
          extractFrom: 'headers', // Extract from HTTP headers
          logLevel: 'debug',
        }),
      },
    },
  }),
});

// Get the agent from Mastra instance (important for observability)
const chatAgent = mastra.getAgent('chatAgent');

const app = express();
app.use(express.json());

// Add OTEL middleware to extract trace context
app.use(expressMiddleware());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const hasOtelContext = !!req.requestContext;
    const otelHeaders = req.requestContext?.get('otel.headers') as
      | { traceparent?: string; tracestate?: string }
      | undefined;

    console.log('Request received:', {
      message,
      hasOtelContext,
      contextKeys: req.requestContext ? Array.from(req.requestContext.keys()) : [],
      otelHeaders,
    });

    // Pass requestContext to agent - this contains extracted OTEL headers
    const result = await chatAgent.generate([{ role: 'user', content: message }], {
      requestContext: req.requestContext,
    });

    res.json({
      response: result.text,
      otelContext: {
        extracted: hasOtelContext,
        message: hasOtelContext
          ? 'OTEL trace context was successfully extracted from headers'
          : 'No OTEL trace context found in request headers',
        headers: otelHeaders,
      },
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = 3456;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `\nTest with:\ncurl -X POST http://localhost:${PORT}/chat -H "Content-Type: application/json" -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" -d '{"message":"Hello!"}'`,
  );
});
