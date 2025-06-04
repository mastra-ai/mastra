import * as child_process from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Deployer } from '@mastra/deployer';

interface LambdaConfig {
  functionName: string;
  region: string;
  runtime?: string;
  timeout?: number;
  memorySize?: number;
  stackName?: string;
}

export class AwsLambdaDeployer extends Deployer {
  readonly name = 'aws-lambda';
  private functionName: string;
  private region: string;
  private runtime: string;
  private timeout: number;
  private memorySize: number;
  private stackName: string;

  constructor({
    functionName,
    region,
    runtime = 'nodejs20.x',
    timeout = 30,
    memorySize = 256,
    stackName,
  }: LambdaConfig) {
    super({ name: 'aws-lambda' });
    this.functionName = functionName;
    this.region = region;
    this.runtime = runtime;
    this.timeout = timeout;
    this.memorySize = memorySize;
    this.stackName = stackName || `${functionName}-stack`;
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);
  }

  private getEntry(): string {
    return `
import { handle } from 'hono/aws-lambda';
import { mastra } from '#mastra';
import { createHonoServer } from '#server';
import { evaluate } from '@mastra/core/eval';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';
import { TABLE_EVALS } from '@mastra/core/storage';
import { checkEvalStorageFields } from '@mastra/core/utils';

// Register hooks before creating the server
registerHook(AvailableHooks.ON_GENERATION, ({ input, output, metric, runId, agentName, instructions }) => {
  evaluate({
    agentName,
    input,
    metric,
    output,
    runId,
    globalRunId: runId,
    instructions,
  });
});

registerHook(AvailableHooks.ON_EVALUATION, async traceObject => {
  const storage = mastra.getStorage();
  if (storage) {
    // Check for required fields
    const logger = mastra?.getLogger();
    const areFieldsValid = checkEvalStorageFields(traceObject, logger);
    if (!areFieldsValid) return;

    await storage.insert({
      tableName: TABLE_EVALS,
      record: {
        input: traceObject.input,
        output: traceObject.output,
        result: JSON.stringify(traceObject.result || {}),
        agent_name: traceObject.agentName,
        metric_name: traceObject.metricName,
        instructions: traceObject.instructions,
        test_info: null,
        global_run_id: traceObject.globalRunId,
        run_id: traceObject.runId,
        created_at: new Date().toISOString(),
      },
    });
  }
});

// Initialize the app - Lambda will handle the async nature
const app = createHonoServer(mastra);

// AWS Lambda handler following Hono documentation pattern
export const handler = handle(app);
`;
  }

  private generateCDKApp(): string {
    return `#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ${this.stackName.replace(/-/g, '')}Stack } from './stack';

const app = new cdk.App();
new ${this.stackName.replace(/-/g, '')}Stack(app, '${this.stackName}', {
  env: {
    region: '${this.region}',
  },
});
`;
  }

  private generateCDKStack(): string {
    return `import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class ${this.stackName.replace(/-/g, '')}Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Lambda function
    const lambdaFunction = new NodejsFunction(this, '${this.functionName}', {
      entry: 'index.mjs',
      handler: 'handler',
      runtime: lambda.Runtime.${this.runtime.toUpperCase().replace(/\./g, '_')},
      timeout: cdk.Duration.seconds(${this.timeout}),
      memorySize: ${this.memorySize},
      role: lambdaRole,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2022',
        format: 'esm',
        mainFields: ['module', 'main'],
        externalModules: [],
      },
      environment: {
        NODE_ENV: 'production',
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'MastraApi', {
      restApiName: '${this.functionName}-api',
      description: 'Mastra API Gateway for ${this.functionName}',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // Add proxy resource to handle all routes
    const proxyResource = api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: lambdaFunction.functionName,
      description: 'Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: lambdaFunction.functionArn,
      description: 'Lambda Function ARN',
    });
  }
}
`;
  }

  private generatePackageJSON(): string {
    return JSON.stringify(
      {
        name: `${this.functionName}-cdk`,
        version: '1.0.0',
        description: `CDK app for ${this.functionName}`,
        type: 'module',
        scripts: {
          build: 'tsc',
          watch: 'tsc -w',
          test: 'jest',
          cdk: 'cdk',
          deploy: 'cdk deploy',
          destroy: 'cdk destroy',
          diff: 'cdk diff',
          synth: 'cdk synth',
        },
        devDependencies: {
          '@types/node': '^20.17.27',
          'aws-cdk': '^2.169.0',
          'aws-cdk-lib': '^2.169.0',
          constructs: '^10.4.2',
          'source-map-support': '^0.5.21',
          typescript: '^5.8.2',
        },
      },
      null,
      2,
    );
  }

  private generateCDKJSON(): string {
    return JSON.stringify(
      {
        app: 'npx tsx app.ts',
        requireApproval: 'never',
        watch: {
          include: ['**'],
          exclude: [
            'README.md',
            'cdk*.json',
            '**/*.d.ts',
            '**/*.js',
            'tsconfig.json',
            'package*.json',
            'yarn.lock',
            'node_modules',
            'test',
          ],
        },
        context: {
          '@aws-cdk/aws-lambda:recognizeLayerVersion': true,
          '@aws-cdk/core:checkSecretUsage': true,
          '@aws-cdk/core:target-partitions': ['aws', 'aws-cn'],
          '@aws-cdk-containers/ecs-service-extensions:enableDefaultLogDriver': true,
          '@aws-cdk/aws-ec2:uniqueImdsv2TemplateName': true,
          '@aws-cdk/aws-ecs:arnFormatIncludesClusterName': true,
          '@aws-cdk/aws-iam:minimizePolicies': true,
          '@aws-cdk/core:validateSnapshotRemovalPolicy': true,
          '@aws-cdk/aws-codepipeline:crossAccountKeyAliasStackSafeResourceName': true,
          '@aws-cdk/aws-s3:createDefaultLoggingPolicy': true,
          '@aws-cdk/aws-sns-subscriptions:restrictSqsDescryption': true,
          '@aws-cdk/aws-apigateway:disableCloudWatchRole': false,
          '@aws-cdk/core:enablePartitionLiterals': true,
          '@aws-cdk/aws-events:eventsTargetQueueSameAccount': true,
          '@aws-cdk/aws-iam:standardizedServicePrincipals': true,
          '@aws-cdk/aws-ecs:disableExplicitDeploymentControllerForCircuitBreaker': true,
          '@aws-cdk/aws-iam:importedRoleStackSafeDefaultPolicyName': true,
          '@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy': true,
          '@aws-cdk/aws-route53-patters:useCertificate': true,
          '@aws-cdk/customresources:installLatestAwsSdkDefault': false,
          '@aws-cdk/aws-rds:databaseProxyUniqueResourceName': true,
          '@aws-cdk/aws-codedeploy:removeAlarmsFromDeploymentGroup': true,
          '@aws-cdk/aws-apigateway:authorizerChangeDeploymentLogicalId': true,
          '@aws-cdk/aws-ec2:launchTemplateDefaultUserData': true,
          '@aws-cdk/aws-secretsmanager:useAttachedSecretResourcePolicyForSecretTargetAttachments': true,
          '@aws-cdk/aws-redshift:columnId': true,
          '@aws-cdk/aws-stepfunctions-tasks:enableLoggingConfiguration': true,
          '@aws-cdk/aws-ec2:restrictDefaultSecurityGroup': true,
          '@aws-cdk/aws-apigateway:requestValidatorUniqueId': true,
          '@aws-cdk/aws-kms:aliasNameRef': true,
          '@aws-cdk/aws-autoscaling:generateLaunchTemplateInsteadOfLaunchConfig': true,
          '@aws-cdk/core:includePrefixInUniqueNameGeneration': true,
          '@aws-cdk/aws-efs:denyAnonymousAccess': true,
          '@aws-cdk/aws-opensearchservice:enableLoggingConfiguration': true,
          '@aws-cdk/aws-s3:autoDeleteObjectsPolicy': true,
          '@aws-cdk/aws-ec2:vpnConnectionLogging': true,
          '@aws-cdk/aws-lambda:handlerSignatureUsesTypeScriptNeverType': true,
        },
      },
      null,
      2,
    );
  }

  private generateTSConfig(): string {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'commonjs',
          lib: ['es2022'],
          declaration: true,
          strict: true,
          noImplicitAny: true,
          strictNullChecks: true,
          noImplicitThis: true,
          alwaysStrict: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: false,
          inlineSourceMap: true,
          inlineSources: true,
          experimentalDecorators: true,
          strictPropertyInitialization: false,
          typeRoots: ['./node_modules/@types'],
        },
        exclude: ['cdk.out'],
      },
      null,
      2,
    );
  }

  private writeCDKFiles(outputDirectory: string): void {
    const cdkDir = join(outputDirectory, this.outputDir);

    // Write CDK app files
    writeFileSync(join(cdkDir, 'app.ts'), this.generateCDKApp());
    writeFileSync(join(cdkDir, 'stack.ts'), this.generateCDKStack());
    writeFileSync(join(cdkDir, 'package.json'), this.generatePackageJSON());
    writeFileSync(join(cdkDir, 'cdk.json'), this.generateCDKJSON());
    writeFileSync(join(cdkDir, 'tsconfig.json'), this.generateTSConfig());

    // Write README with deployment instructions
    writeFileSync(
      join(cdkDir, 'README.md'),
      `# ${this.functionName} CDK Deployment

This directory contains a complete AWS CDK application for deploying your Mastra application to AWS Lambda.

## Prerequisites

1. Install AWS CLI and configure credentials:
   \`\`\`bash
   aws configure
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Bootstrap CDK (one-time setup per AWS account/region):
   \`\`\`bash
   npx cdk bootstrap
   \`\`\`

## Deployment

Deploy the stack:
\`\`\`bash
npm run deploy
\`\`\`

## Other Commands

- \`npm run diff\` - Compare deployed stack with current state
- \`npm run synth\` - Emit the synthesized CloudFormation template
- \`npm run destroy\` - Destroy the stack

## Stack Details

- **Function Name**: ${this.functionName}
- **Runtime**: ${this.runtime}
- **Memory**: ${this.memorySize} MB
- **Timeout**: ${this.timeout} seconds
- **Region**: ${this.region}

The stack includes:
- Lambda function with your Mastra application
- API Gateway for HTTP endpoints
- IAM roles with appropriate permissions
- CloudWatch logs for monitoring
`,
    );

    this.logger.info(`✓ Generated CDK application in ${cdkDir}`);
  }

  async bundle(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    const result = await this._bundle(this.getEntry(), entryFile, outputDirectory, toolsPaths);

    // Generate CDK infrastructure files
    this.writeCDKFiles(outputDirectory);

    return result;
  }

  async deploy(outputDirectory: string): Promise<void> {
    this.logger.info('Starting CDK deployment...');

    const cdkDir = join(outputDirectory, this.outputDir);

    try {
      // Install CDK dependencies
      this.logger.info('Installing CDK dependencies...');
      child_process.execSync('npm install', {
        cwd: cdkDir,
        stdio: 'inherit',
      });

      // Load environment variables and set them for CDK
      const envVars = await this.loadEnvVars();
      const deployEnv = { ...process.env };

      // Add Mastra environment variables to deployment environment
      for (const [key, value] of envVars.entries()) {
        deployEnv[key] = value;
      }

      // Bootstrap CDK if needed (will be skipped if already bootstrapped)
      this.logger.info('Ensuring CDK is bootstrapped...');
      try {
        child_process.execSync(`npx cdk bootstrap aws://$\{AWS_ACCOUNT_ID\}/${this.region}`, {
          cwd: cdkDir,
          stdio: 'inherit',
          env: deployEnv,
        });
      } catch {
        this.logger.info('CDK bootstrap may already be complete or credentials may need configuration');
      }

      // Deploy the stack
      this.logger.info(`Deploying stack: ${this.stackName}`);
      child_process.execSync('npx cdk deploy --require-approval never', {
        cwd: cdkDir,
        stdio: 'inherit',
        env: deployEnv,
      });

      this.logger.info('✓ CDK deployment completed successfully!');
      this.logger.info(`Stack name: ${this.stackName}`);
      this.logger.info(`Region: ${this.region}`);
      this.logger.info(`Function name: ${this.functionName}`);

      if (envVars.size > 0) {
        this.logger.info(`Environment variables configured: ${Array.from(envVars.keys()).join(', ')}`);
      }

      this.logger.info('\nTo view stack outputs:');
      this.logger.info(`  cd ${cdkDir} && npx cdk outputs`);
      this.logger.info('\nTo destroy the stack:');
      this.logger.info(`  cd ${cdkDir} && npx cdk destroy`);
    } catch (error) {
      this.logger.error('CDK deployment failed:', error as Error);
      this.logger.error('\nTroubleshooting:');
      this.logger.error('1. Ensure AWS credentials are configured: aws configure');
      this.logger.error('2. Ensure you have the necessary AWS permissions');
      this.logger.error('3. Check the AWS CloudFormation console for detailed error information');
      throw error;
    }
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);

    // AWS Lambda specific linting checks
    this.logger.info('Running AWS Lambda specific checks...');

    // Check if required parameters are provided
    if (!this.functionName) {
      this.logger.error('Function name is required');
      process.exit(1);
    }

    if (!this.region) {
      this.logger.error('AWS region is required');
      process.exit(1);
    }

    // Validate runtime
    const validRuntimes = ['nodejs18.x', 'nodejs20.x'];
    if (!validRuntimes.includes(this.runtime)) {
      this.logger.warn(`Runtime ${this.runtime} may not be supported. Recommended: ${validRuntimes.join(', ')}`);
    }

    // Check memory size limits
    if (this.memorySize < 128 || this.memorySize > 10240) {
      this.logger.error('Memory size must be between 128 MB and 10,240 MB');
      process.exit(1);
    }

    // Check timeout limits
    if (this.timeout < 1 || this.timeout > 900) {
      this.logger.error('Timeout must be between 1 and 900 seconds (15 minutes)');
      process.exit(1);
    }

    // Validate stack name
    if (!/^[a-zA-Z][-a-zA-Z0-9]*$/.test(this.stackName)) {
      this.logger.error('Stack name must start with a letter and contain only letters, numbers, and hyphens');
      process.exit(1);
    }

    this.logger.info('✓ AWS Lambda CDK configuration is valid');
  }
}
