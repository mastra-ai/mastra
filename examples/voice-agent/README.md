# Voice Agent Demo

This project demonstrates speech-to-speech interaction with an AI voice agent powered by OpenAI's models. It creates a conversational interface where users can speak to the agent and receive spoken responses in real-time.

## Prerequisites

- OpenAI API key
- sox installed for audio

## Installation

1. Install dependencies:

   ```
   pnpm install
   ```

2. Set up your OpenAI API key:
   - Create a `.env.development` file in the root directory
   - Add your OpenAI API key:
     ```
     OPENAI_API_KEY=your_openai_api_key_here
     ```

## Usage

Start the application:

```
pnpm start
```

The voice agent will greet you, and you can begin speaking with it. The agent is configured to help with cafe orders and answer questions about the menu.

## How It Works

1. The application uses `node-mic` to capture audio from your microphone
2. Audio is processed in chunks and sent to the agent
3. The agent processes your speech and generates a response
4. The response is converted to speech using OpenAI's text-to-speech API
5. The audio is played back through your speakers using the `speaker` module

## License

[MIT](LICENSE)
