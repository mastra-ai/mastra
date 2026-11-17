import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AgentCoreProjectSpecSchema, getSessionProjectRoot, setSessionProjectRoot } from '@aws/agentcore-cdk';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CloudAssembly } from 'aws-cdk-lib/cx-api';
import { afterAll, expect, test } from 'vitest';
import { AgentCoreStack } from '../lib/cdk-stack';

const sourceDir = mkdtempSync(join(tmpdir(), 'mongodb-bedrock-cdk-'));
const previousProjectRoot = getSessionProjectRoot() ?? '';

afterAll(() => {
  CloudAssembly.cleanupTemporaryDirectories();
  setSessionProjectRoot(previousProjectRoot);
  rmSync(sourceDir, { recursive: true, force: true });
});

test('deploys the documentation agent with MongoDB settings, HTTP access, and Bedrock permissions', () => {
  // Synthesis stages source files but never builds an image or contacts AWS.
  writeFileSync(join(sourceDir, 'Dockerfile'), 'FROM scratch\n');
  mkdirSync(join(sourceDir, 'agentcore'));
  copyFileSync(
    resolve(__dirname, '../../mongodb-secret-policy.json'),
    join(sourceDir, 'agentcore/mongodb-secret-policy.json'),
  );
  const config = JSON.parse(readFileSync(resolve(__dirname, '../../agentcore.json'), 'utf8'));
  const spec = AgentCoreProjectSpecSchema.parse({
    ...config,
    runtimes: config.runtimes.map((runtime: Record<string, unknown>) => ({ ...runtime, codeLocation: sourceDir })),
  });
  const mongodbSecretArn = spec.runtimes[0].envVars?.find(variable => variable.name === 'MONGODB_SECRET_ARN')?.value;
  expect(mongodbSecretArn).toMatch(/^arn:[^:]+:secretsmanager:[^:]+:\d{12}:secret:.+$/);
  setSessionProjectRoot(resolve(__dirname, '../../..'));

  const app = new App();
  const stack = new AgentCoreStack(app, 'DocumentationAgent', {
    env: { account: '123456789012', region: 'us-east-1' },
    spec,
  });
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::BedrockAgentCore::Runtime', 1);
  template.hasResourceProperties('AWS::BedrockAgentCore::Runtime', {
    AgentRuntimeName: 'mastramongoaws_MastraAgent',
    NetworkConfiguration: { NetworkMode: 'PUBLIC' },
    EnvironmentVariables: Match.objectLike({
      MONGODB_DATABASE: 'mastra_docs',
      MONGODB_SECRET_ARN: mongodbSecretArn,
      AWS_REGION: 'us-east-1',
      EMBED_DIMENSION: '1024',
    }),
  });
  const [runtime] = Object.values(template.findResources('AWS::BedrockAgentCore::Runtime'));
  expect(runtime.Properties.ProtocolConfiguration ?? 'HTTP').toBe('HTTP');
  expect(runtime.Properties.EnvironmentVariables).not.toHaveProperty('MONGODB_URI');
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        {
          Effect: 'Allow',
          Action: 'secretsmanager:GetSecretValue',
          Resource: mongodbSecretArn,
        },
      ]),
    },
  });
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Effect: 'Allow',
          Action: Match.arrayWith(['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream']),
        }),
      ]),
    },
  });
});
