# Army Example

This example demonstrates the workflow suspension and resume features of Mastra. It simulates a military command structure where attacks need permission before execution.

## Features

- Local Express server for handling questions and answers
- LowDB for JSON-based local storage
- PostgreSQL for workflow state persistence
- Workflow suspension when waiting for answers
- Workflow resumption from persisted state

## Setup

1. Start the PostgreSQL database:

```bash
docker-compose up -d
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the application:

```bash
pnpm start
```

## Usage

1. Launch an attack (it will be suspended waiting for permission):

```bash
pnpm start attack paris
```

2. The attack will be suspended after 3 retries, and you'll get a run ID.

3. To approve the attack, use curl or any HTTP client to post an answer:

```bash
# Get the questionId from the questions endpoint first
curl -X POST http://localhost:3000/answers -H "Content-Type: application/json" -d '{"questionId":"QUESTION_ID","text":"yes"}'
```

4. Resume the suspended workflow:

```bash
pnpm start resume RUN_ID
```

## How it Works

1. The `attack` command initiates a workflow with three steps:

   - `askForPermission`: Posts a question to the local server
   - `checkPermission`: Polls for an answer (retries 3 times before suspending)
   - `attack`: Executes the attack if approved

2. When no answer is found after 3 retries, the workflow is suspended and its state is persisted to PostgreSQL.

3. The `resume` command loads the persisted state and continues the workflow from where it left off.
