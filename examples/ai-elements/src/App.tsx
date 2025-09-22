import { useAgents } from '@mastra/react-hooks';
import { MastraReactProvider } from '@mastra/react-hooks';
import './App.css';

export default function App() {
  return (
    <MastraReactProvider baseUrl="http://localhost:4111">
      <Agents />
    </MastraReactProvider>
  );
}

function Agents() {
  const { agents, isLoading } = useAgents();

  if (isLoading) return <div>Loading...</div>;
  const agentsList = Object.entries(agents || {}).map(([key, agent]) => <li key={key}>{agent?.name}</li>);
  if (agentsList.length === 0) return <div>No agents found</div>;

  return <ul>{agentsList}</ul>;
}
