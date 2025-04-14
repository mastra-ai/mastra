import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({
  baseUrl: 'http://localhost:4111',
});

function App() {
  const [count, setCount] = useState(0);
  const [color, setColor] = useState('red');
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [posts, setPosts] = useState([]);
  const [responseText, setResponseText] = useState('');
  const [logoSize, setLogoSize] = useState({ height: '20px', width: '20px' });

  const clientSideToolCallsMap: Record<string, any> = {
    changeColor: {
      id: 'changeColor',
      description: 'Changes the background color',
      inputSchema: {
        type: 'object',
        properties: {
          color: { type: 'string' },
        },
        required: ['color'], // Now name is required
      },
      execute: (props: { color: string }) => {
        setColor(props.color);
      },
    },
    changeLogoSize: {
      id: 'changeLogoSize',
      description: 'Changes the size of the logo',
      inputSchema: {
        type: 'object',
        properties: {
          height: { type: 'string' },
          width: { type: 'string' },
        },
        required: ['height', 'width'],
      },
      execute: (props: { height: string; width: string }) => {
        setLogoSize({ height: props.height, width: props.width });
      },
    },
    addPost: {
      id: 'addPost',
      description: 'Add a new post',
      inputSchema: {
        type: 'object',
        properties: {
          color: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['color', 'name'], // Now name is required
      },
      execute: (props: { color: string; name: string }) => {
        setPosts(prev => [...prev, props]);
      },
    },
  };

  async function streamIt({ prompt }: { prompt: string }) {
    const agent = client.getAgent('agent');
    const response = await agent.stream({
      messages: prompt,
      clientTools: clientSideToolCallsMap,
    });

    response.processDataStream({
      onToolCallPart: part => {
        console.log('Tool Call', part);

        const toolCall = clientSideToolCallsMap[part.toolName].execute(part.args);

        console.log('Tool Call', toolCall);
      },
      onToolResultPart: part => {
        console.log('Result', part);
      },
      onToolCallDeltaPart: part => {
        console.log('Delta', part);
      },
      onTextPart: (part: string) => {
        setResponseText(prev => prev + part);
      },
    });
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img height={logoSize.height} width={logoSize.width} src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1 style={{ color: color }}>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount(count => count + 1)}>count is {count}</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      {posts?.map((post, index) => (
        <div key={index}>
          <p>{post.name}</p>
          <p>{post.color}</p>
        </div>
      ))}
      {responseText && (
        <div
          className="card"
          style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '8px' }}
        >
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{responseText}</p>
        </div>
      )}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Enter your message..."
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              width: '100%',
            }}
          />
          <button
            onClick={() => {
              if (message.trim()) {
                setIsStreaming(true);
                setResponseText(''); // Clear previous response
                streamIt({ prompt: message })
                  .catch(console.error)
                  .finally(() => setIsStreaming(false));
              }
            }}
            disabled={isStreaming}
            style={{ minWidth: '100px' }}
          >
            {isStreaming ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
