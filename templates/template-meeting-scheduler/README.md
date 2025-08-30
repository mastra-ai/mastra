# Google Calendar Meeting Scheduler Template

An intelligent email-to-calendar agent built with Mastra that analyzes Gmail messages for meeting requests and automatically creates Google Calendar events with all email thread participants.

## Overview

This template provides an AI-powered assistant that:

- Monitors Gmail for meeting-related emails
- Intelligently extracts meeting details (date, time, location, participants)
- Automatically creates Google Calendar events
- Invites all email thread participants
- Handles authorization flows seamlessly through [Arcade](https://arcade.dev)

## Features

- **Smart Email Analysis**: Uses the configured LLM to understand meeting context from email content
- **Meeting Detection**: Identifies time/date mentions, meeting keywords, and participant lists
- **Automatic Calendar Integration**: Creates events with extracted details
- **Participant Management**: Automatically invites everyone in the email thread
- **Memory System**: Maintains conversation context and learning
- **Authorization Handling**: Streamlined OAuth flow via Arcade tools

## Prerequisites

- Node.js >= 20.9.0
- Google account (for Gmail and Calendar access)
- Anthropic API key
- Arcade API key

## Setup

1. **Create a new project from this template:**

   ```bash
   npx create-mastra@latest --template meeting-scheduler
   cd meeting-scheduler
   pnpm install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your API keys:

   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ARCADE_API_KEY=your_arcade_api_key_here
   ```

3. **Start the development server:**

   ```bash
   pnpm dev
   ```

## Usage

1. **Initial Authorization**: When you first interact with the agent, it will provide authorization URLs for Gmail and Google Calendar access. Arcade handles the OAuth flow automatically.

2. **Meeting Detection**: The agent will analyze your Gmail messages looking for:
   - Time and date mentions ("next Tuesday at 2pm", "December 15th at 10:00 AM")
   - Meeting keywords ("meeting", "call", "discussion", "catch up", "sync")
   - Location references (office addresses, meeting rooms, video links)
   - Email threads with multiple participants

3. **Calendar Event Creation**: When meeting details are detected, the agent will:
   - Extract relevant information from the email
   - Create a calendar event with appropriate title
   - Set the proposed date and time
   - Invite all email thread participants
   - Add email content as event description

## Configuration

### Environment Variables

- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude model access
- `ARCADE_API_KEY`: Your Arcade API key for Gmail and Calendar tool access

### Google Services

Google OAuth authentication is handled automatically by Arcade - no manual setup required. When prompted, simply visit the provided authorization URLs to grant access.

## Project Structure

```
src/
├── mastra/
│   ├── index.ts              # Main Mastra configuration
│   └── agents/
│       └── meeting-scheduler.ts   # Core agent implementation
├── package.json             # Project dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

## How It Works

1. The agent uses Arcade tools to access Gmail and Google Calendar APIs
2. Configured LLM analyzes email content for meeting indicators
3. When meetings are detected, calendar events are created automatically

## Authentication Flow

The agent handles Google service authentication through Arcade:

1. First time usage triggers authorization request
2. Agent provides clickable authorization URLs
3. User grants permissions through Google OAuth
4. Subsequent requests work automatically
