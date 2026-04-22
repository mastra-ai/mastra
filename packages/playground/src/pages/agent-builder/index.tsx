import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function AgentBuilder() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate('/agent-builder/agents/create');
  }, [navigate]);
  return null;
}
