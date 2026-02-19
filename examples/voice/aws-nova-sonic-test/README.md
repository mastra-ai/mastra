# AWS Nova 2 Sonic Voice Test - Web Application

A Next.js web application for testing the `@mastra/voice-aws-nova-sonic` integration with a browser-based UI for real-time voice conversations.

## Overview

This web application provides a user-friendly interface to test AWS Nova 2 Sonic's bidirectional streaming capabilities:
- **Connect/Disconnect** button to establish connection to AWS Bedrock
- **Microphone button** to record and send audio
- **Real-time conversation** display showing both user and assistant messages
- **Audio playback** of assistant responses

## Prerequisites

Before running this application, ensure you have:

1. **Node.js >= 22.13.0** installed
2. **AWS Account** with access to Amazon Bedrock
3. **Nova 2 Sonic Model Access** enabled in your AWS region
4. **AWS Credentials** configured (see [AWS Setup](#aws-setup))

## AWS Setup

### 1. Enable Nova 2 Sonic in Amazon Bedrock

1. Go to the [Amazon Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Navigate to "Model access" in the left sidebar
3. Request access to "Amazon Nova 2 Sonic" model
4. Wait for approval (usually instant)

### 2. Configure AWS Credentials

You can configure AWS credentials in several ways:

**Option 1: Environment Variables** (Recommended for development)
```bash
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_REGION=us-east-1
```

**Option 2: AWS Credentials File**
```ini
# ~/.aws/credentials
[default]
aws_access_key_id = your-access-key-id
aws_secret_access_key = your-secret-access-key
```

**Option 3: IAM Role** (for EC2/Lambda)
- Attach an IAM role with Bedrock permissions to your EC2 instance or Lambda function

### 3. IAM Permissions

Your AWS credentials need the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithBidirectionalStream"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/amazon.nova-2-sonic-v1:0"
    }
  ]
}
```

### 4. Agent Model Configuration

The application uses an AWS Bedrock model for the Agent (default: `amazon/nova-pro`). You can override this with:

```bash
export AGENT_MODEL=amazon/nova-lite  # or amazon/nova-micro, amazon/nova-pro
```

**Available AWS Bedrock models:**
- `amazon/nova-lite` - Fastest, most cost-effective
- `amazon/nova-micro` - Balanced performance
- `amazon/nova-pro` - Highest quality (default)

### 5. Voice Configuration

You can customize the voice used by Nova 2 Sonic:

```bash
export VOICE_SPEAKER=tiffany  # or matthew, amy, olivia, etc.
```

**Available Voices:**

Nova 2 Sonic supports 18 expressive voices across 10 languages:

**Polyglot Voices** (can speak all supported languages):
- `tiffany` - English (US), Feminine
- `matthew` - English (US), Masculine

**English Variants:**
- `amy` - English (UK), Feminine
- `olivia` - English (Australia), Feminine
- `kiara` - English (Indian) / Hindi, Feminine
- `arjun` - English (Indian) / Hindi, Masculine

**Other Languages:**
- `ambre`, `florian` - French
- `beatrice`, `lorenzo` - Italian
- `tina`, `lennart` - German
- `lupe`, `carlos` - Spanish (US)
- `carolina`, `leo` - Portuguese

**Advanced Configuration:**

You can customize the voice behavior in `src/mastra/agents/index.ts`:

- **Inference Configuration**: Control response generation (maxTokens, temperature, topP, topK, stopSequences)
- **Turn-Taking**: Adjust voice activity detection sensitivity and silence duration
- **Tools**: Enable function calling with custom tools
- **Knowledge Base**: Enable RAG (Retrieval-Augmented Generation) with AWS Bedrock Knowledge Bases
- **Tool Choice**: Control which tools are used ('auto', 'any', or specific tool)

## Installation

**⚠️ IMPORTANT: You must install dependencies from the monorepo root, not from this directory!**

1. **From the monorepo root**, install all dependencies:
```bash
# Navigate to the monorepo root
cd <path-to-mastra-monorepo-root>

# Install all dependencies (this will set up workspace links)
pnpm install
```

2. **Build the required packages** (if not already built):
```bash
# Still from the monorepo root
pnpm --filter @mastra/core build
pnpm --filter @mastra/voice-aws-nova-sonic build
```

3. **Navigate to the test package directory**:
```bash
cd examples/voice/aws-nova-sonic-test
```

**Why this is necessary:**
- This is a pnpm workspace monorepo
- Dependencies are hoisted to the root `node_modules`
- The workspace links in `package.json` create symlinks to local packages
- Running `pnpm install` from the example directory won't work - it must be from the root

## Running the Application

1. **Start the development server**:
```bash
pnpm dev
```

2. **Open your browser** and navigate to:
```md
http://localhost:3000
```

## Using the Application

1. **Connect**: Click the "Connect" button to establish a connection to AWS Bedrock Nova 2 Sonic
2. **Start Recording**: Click "Start Recording" to begin capturing audio from your microphone
3. **Speak**: Speak into your microphone - the audio will be sent to the model
4. **View Responses**: See both your transcribed speech and the assistant's responses in the conversation area
5. **Listen**: Assistant responses will be played automatically as audio
6. **Stop Recording**: Click "Stop Recording" when you're done speaking
7. **Disconnect**: Click "Disconnect" when you're finished

## Features

- **Real-time Voice Conversation**: Speak naturally and receive voice responses
- **Visual Feedback**: See connection status, recording state, and conversation history
- **Error Handling**: Clear error messages if something goes wrong
- **Automatic Audio Playback**: Assistant responses are played automatically
- **Message History**: View the full conversation with timestamps

## Troubleshooting

### Error: "Cannot find package '@mastra/core'" or "node_modules missing"

**This is the most common issue!** You must install dependencies from the monorepo root:

```bash
# From the monorepo root (NOT from this directory)
cd <path-to-mastra-monorepo-root>
pnpm install
```

Then navigate back to this directory and try again:
```bash
cd examples/voice/aws-nova-sonic-test
pnpm dev
```

**Why?** This is a pnpm workspace monorepo. Dependencies are hoisted to the root `node_modules`, and workspace links only work when installed from the root.

### Error: "Credentials missing" or "Authentication failed"

- Verify your AWS credentials are correctly configured
- Check that your AWS credentials have the required IAM permissions
- Ensure the AWS region is correct (us-east-1, us-west-2, or ap-northeast-1)

### Error: "Model access denied"

- Go to the Amazon Bedrock Console and request access to Nova 2 Sonic
- Wait for approval (usually instant)

### Error: "Connection failed"

- Check your internet connection
- Verify AWS Bedrock is available in your region
- Check AWS service status

### Microphone not working

- Ensure your browser has permission to access the microphone
- Check browser settings for microphone permissions
- Try refreshing the page and granting permissions again

### No audio playback

- Check your browser's audio settings
- Ensure your system volume is not muted
- Check browser console for audio playback errors

### Agent model errors

- Verify your AWS credentials have access to the Bedrock model you're using
- Check that the model is enabled in your AWS Bedrock console
- Try a different model (e.g., `amazon/nova-lite` instead of `amazon/nova-pro`)

## Architecture

The application consists of:

- **Frontend** (`app/`): Next.js React components for the UI
- **API Routes** (`app/api/voice/`): Server-side endpoints for voice operations
- **Agent Configuration** (`src/mastra/agents/`): Singleton agent instance with Nova Sonic voice

The agent instance is shared across API routes to maintain the connection state.

## Additional resources

- [AWS Nova 2 Sonic Documentation](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html)
- [@mastra/voice-aws-nova-sonic Package](../../../voice/aws-nova-sonic/README.md)
- [Mastra Voice Documentation](https://mastra.ai/docs/voice)
