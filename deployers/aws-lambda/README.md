# @mastra/deployer-aws-lambda

AWS Lambda deployer for Mastra applications using AWS CDK (Cloud Development Kit). This deployer generates a complete CDK application that includes Lambda function, API Gateway, IAM roles, and all necessary AWS infrastructure.

## Installation

```bash
pnpm add @mastra/deployer-aws-lambda
```

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 18 or higher
- AWS CDK CLI installed globally: `npm install -g aws-cdk`

## Usage

```typescript
import { AwsLambdaDeployer } from '@mastra/deployer-aws-lambda';

const deployer = new AwsLambdaDeployer({
  functionName: 'my-mastra-app',
  region: 'us-east-1',
  runtime: 'nodejs20.x',
  timeout: 30,
  memorySize: 128,
  stackName: 'my-mastra-app-stack', // optional
});

// Prepare the deployment
await deployer.prepare('./output');

// Bundle the application and generate CDK infrastructure
await deployer.bundle('./src/mastra/index.ts', './output', []);

// Deploy using CDK
await deployer.deploy('./output');
```

## Configuration

### Required Parameters

- `functionName`: The name of the Lambda function
- `region`: AWS region where the stack will be deployed

### Optional Parameters

- `runtime`: Lambda runtime (default: 'nodejs20.x')
- `timeout`: Function timeout in seconds (default: 30, max: 900)
- `memorySize`: Memory allocation in MB (default: 128, range: 128-10240)
- `stackName`: CDK stack name (default: `${functionName}-stack`)

## Features

- **✅ Complete CDK Application**: Generates a full CDK app with infrastructure as code
- **✅ API Gateway Integration**: Automatic REST API setup with Lambda proxy integration
- **✅ IAM Role Management**: Creates appropriate execution roles with minimal permissions
- **✅ Environment Variables**: Seamless environment variable configuration
- **✅ Hono Integration**: Uses [hono/aws-lambda](https://hono.dev/docs/getting-started/aws-lambda) for request handling
- **✅ Evaluation Hooks**: Includes built-in evaluation and storage hooks
- **✅ Infrastructure Versioning**: CDK app can be version controlled and customized
- **✅ Professional Deployment**: Uses standard AWS CDK deployment patterns
- **✅ CloudWatch Logging**: Automatic log group setup and retention

## Generated Infrastructure

The deployer creates a complete CDK application with the following AWS resources:

### Lambda Function
- Node.js runtime with configurable memory and timeout
- Automatic bundling with esbuild for optimal performance
- Environment variable configuration
- CloudWatch logging enabled

### API Gateway
- REST API with CORS enabled
- Lambda proxy integration for all HTTP methods
- Automatic request/response handling

### IAM Roles
- Lambda execution role with minimal permissions
- CloudWatch logs access for monitoring

### Outputs
- API Gateway URL for accessing your application
- Lambda function name and ARN for reference

## CDK Application Structure

After running `bundle()`, your output directory will contain a complete CDK application:

```
.mastra/
├── app.ts              # CDK app entry point
├── stack.ts            # Infrastructure stack definition
├── index.mjs           # Your bundled Mastra application
├── package.json        # CDK dependencies
├── cdk.json           # CDK configuration
├── tsconfig.json      # TypeScript configuration
└── README.md          # Deployment instructions
```

## AWS Lambda Integration

This deployer generates a Lambda function handler using Hono's AWS Lambda adapter, following the [official Hono documentation](https://hono.dev/docs/getting-started/aws-lambda):

```typescript
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
  // Handle evaluation storage...
});

// Initialize the app - Lambda will handle the async nature
const app = createHonoServer(mastra);

// AWS Lambda handler following Hono documentation pattern
export const handler = handle(app);
```

**Key Implementation Details:**

1. **Hook Registration**: Evaluation hooks are registered before server creation to ensure proper event handling
2. **Async Handling**: The `handle()` function from `hono/aws-lambda` properly manages the async `createHonoServer()` call
3. **Standard Pattern**: Follows the exact pattern shown in the [Hono AWS Lambda documentation](https://hono.dev/docs/getting-started/aws-lambda)

For more information about Hono's AWS Lambda integration, see the [official documentation](https://hono.dev/docs/getting-started/aws-lambda).

## Deployment

The deployer creates a complete AWS CDK application with:

- **Lambda Function**: Your Mastra application code
- **API Gateway**: HTTP API with proxy integration
- **IAM Roles**: Proper execution permissions
- **CloudFormation Stack**: Infrastructure as code

### Deployment Steps

1. **Build your Mastra application**:
   ```bash
   npx mastra build
   ```

2. **Deploy to AWS**:
   ```bash
   npx mastra deploy
   ```

The deployer will:
1. Generate a complete CDK application in `.mastra/output/`
2. Install CDK dependencies
3. Bootstrap CDK (if needed)
4. Deploy your Lambda function and API Gateway

### Generated CDK Structure

```
.mastra/output/
├── app.ts              # CDK app entry point
├── stack.ts            # CloudFormation stack definition
├── package.json        # CDK project configuration
├── cdk.json           # CDK configuration
├── tsconfig.json      # TypeScript configuration
├── README.md          # Deployment instructions
└── lambda-code/       # Your bundled Mastra application
```

## Environment Variables

Environment variables from your `.env` files are automatically included in the Lambda deployment.

## Monitoring and Logs

- **CloudWatch Logs**: Automatic log group creation for your Lambda function
- **CloudWatch Metrics**: Standard Lambda metrics (invocations, duration, errors)
- **AWS X-Ray**: Distributed tracing (if enabled in your Mastra configuration)

## Troubleshooting

### fsevents Bundling Error

If you encounter bundling errors related to `fsevents` (common on macOS), add the following to your `mastra/index.ts` file:

```typescript
export const bundler = {
  externals: [
    'fsevents',
    // Add other native modules that cause bundling issues
    'sharp',
    'canvas',
    'sqlite3',
    'better-sqlite3',
  ],
};
```

This tells the Mastra bundler to exclude these native modules from the bundle, preventing parsing errors.

### CDK Bootstrap

If you get CDK bootstrap errors, run:

```bash
npx cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

### AWS Permissions

Ensure your AWS credentials have the following permissions:
- CloudFormation: Create/Update/Delete stacks
- Lambda: Create/Update functions
- API Gateway: Create/Update APIs
- IAM: Create/Update roles and policies
- S3: Access to CDK bootstrap bucket

## Advanced Configuration

### Custom VPC

To deploy in a custom VPC, modify the generated `stack.ts` file:

```typescript
// In the generated stack.ts file
const lambdaFunction = new NodejsFunction(this, 'MastraFunction', {
  // ... existing configuration
  vpc: ec2.Vpc.fromLookup(this, 'Vpc', {
    vpcId: 'vpc-xxxxxxxxx'
  }),
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
  },
});
```

### Environment-Specific Deployments

For multiple environments, use different stack names:

```typescript
// Development
new AwsLambdaDeployer({
  functionName: 'my-app-dev',
  stackName: 'my-app-dev-stack',
  region: 'us-east-1',
})

// Production
new AwsLambdaDeployer({
  functionName: 'my-app-prod',
  stackName: 'my-app-prod-stack',
  region: 'us-east-1',
})
```

## CDK Commands

After generation, you can use standard CDK commands in the output directory:

```bash
cd .mastra/output
npx cdk diff          # Show deployment differences
npx cdk deploy        # Deploy the stack
npx cdk destroy       # Delete the stack
npx cdk synth         # Generate CloudFormation template
```

## Cost Optimization

- **Memory**: Start with 256MB and adjust based on performance
- **Timeout**: Set the minimum timeout needed for your application
- **Provisioned Concurrency**: Only enable for consistently high-traffic applications
- **Dead Letter Queue**: Configure for error handling and debugging

## Security

The generated CDK stack follows AWS security best practices:

- **Least Privilege IAM**: Lambda execution role with minimal permissions
- **VPC Support**: Optional VPC deployment for network isolation
- **Environment Variables**: Secure handling of configuration values
- **API Gateway**: Built-in request validation and throttling

## Support

For issues specific to the AWS Lambda deployer, please check:

1. AWS CloudFormation console for stack events
2. CloudWatch Logs for runtime errors
3. CDK documentation for advanced configuration options

For general Mastra support, visit the [Mastra documentation](https://mastra.ai/docs).

## Example: Complete Setup

```typescript
import { AwsLambdaDeployer } from '@mastra/deployer-aws-lambda';

const deployer = new AwsLambdaDeployer({
  functionName: 'my-chat-bot',
  region: 'us-east-1',
  runtime: 'nodejs20.x',
  timeout: 60,
  memorySize: 256,
});

// Generate CDK app and deploy
await deployer.prepare('./dist');
await deployer.bundle('./src/mastra/index.ts', './dist', []);
await deployer.deploy('./dist');

// Your API will be available at the output URL
// Check CloudFormation console for the API Gateway URL
```

## Customizing Generated Infrastructure

The generated CDK application can be customized after generation:

1. **Modify `stack.ts`** to add additional AWS resources
2. **Update IAM policies** for additional permissions
3. **Add CloudWatch alarms** for monitoring
4. **Configure VPC settings** if needed
5. **Add environment-specific configurations**

## Troubleshooting

### Common Issues

1. **"Unable to resolve AWS account ID"**
   - Ensure AWS credentials are properly configured
   - Run `aws sts get-caller-identity` to verify

2. **"Stack already exists"**
   - Use a different `stackName` or destroy the existing stack

3. **"Insufficient permissions"**
   - Ensure your AWS user/role has CloudFormation and Lambda permissions

4. **"CDK version mismatch"**
   - The generated CDK app uses CDK v2, ensure compatibility

### Debug Commands

```bash
# Check AWS credentials
aws sts get-caller-identity

# View CDK version
npx cdk --version

# View detailed deployment logs
cd .mastra && npx cdk deploy --verbose
```

## Limitations

- Requires AWS CDK v2
- Lambda cold start times apply (typically 100-500ms)
- API Gateway timeout limit: 30 seconds
- Maximum deployment package size: 250 MB (unzipped)

## Contributing

This package is part of the Mastra monorepo. Please see the main repository for contribution guidelines.

## License

Elastic-2.0 