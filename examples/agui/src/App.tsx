import './App.css';
import { CopilotChat } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { CopilotKit } from '@copilotkit/react-core';

function WeatherAgentChat() {
  return (
    <CopilotChat
      className="container"
      instructions={
        'You are assisting the user as best as you can. Answer in the best way possible given the data you have.'
      }
      labels={{
        title: 'Your Assistant',
        initial: 'Hi! 👋 How can I assist you today?',
      }}
    />
  );
}

function App(): React.ReactElement {
  return (
    <div>
      <CopilotKit runtimeUrl="http://localhost:4111/copilotkit" agent="weatherAgent">
        <WeatherAgentChat />
      </CopilotKit>
    </div>
  );
}

export default App;
