import './App.css';
import { CopilotChat } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { CopilotKit, useCoAgent } from '@copilotkit/react-core';

function WeatherAgentChat() {
  const { state, setState } = useCoAgent({
    name: 'weatherAgent',
  });

  const cities = [
    'New York',
    'Los Angeles',
    'Chicago',
    'Houston',
    'Phoenix',
    'Philadelphia',
    'San Antonio',
    'San Diego',
    'Dallas',
    'San Jose',
    'New Orleans',
    'Seattle',
    'Miami',
    'Boston',
    'Denver',
  ];

  // Randomly pick a city different from the current state
  function randomizeCity() {
    const otherCities = cities.filter(city => city !== state?.city);
    const randomCity = otherCities[Math.floor(Math.random() * otherCities.length)];
    setState({ city: randomCity });
  }

  return (
    <>
      <p>{state?.city}</p>
      <button onClick={randomizeCity}>Change</button>
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
    </>
  );
}

function App(): React.ReactElement {
  return (
    <div>
      <CopilotKit runtimeUrl="http://localhost:4111/copilotkit" agent="weatherAgent" threadId="6">
        <WeatherAgentChat />
      </CopilotKit>
    </div>
  );
}

export default App;
