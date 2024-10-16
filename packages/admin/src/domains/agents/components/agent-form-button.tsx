'use client';

import { useEffect } from 'react';

import { useAgentFormContext } from '../context/agent-form-context';

export const AgentFormButton = () => {
  const { setButtonContainer } = useAgentFormContext();

  useEffect(() => {
    const el = document.getElementById('button-container') as HTMLDivElement;
    if (!el) return;

    setButtonContainer(el);
  }, []);
  return <div id="button-container" className="!mt-10"></div>;
};
