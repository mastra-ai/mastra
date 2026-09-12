import { useEffect, useState } from 'react';
import { createInitialTurns, reply } from './data';
import type { ChatFile, Phase, Scenario } from './data';

export function useStoryConversation(scenario: Scenario) {
  const [turns, setTurns] = useState(() => createInitialTurns(scenario));
  const activeTurn = turns.at(-1);
  const activeId = activeTurn?.id;
  const phase = activeTurn?.phase;
  const busy = phase === 'streaming' || phase === 'approval' || phase === 'question';

  useEffect(() => {
    if (phase !== 'streaming') return;
    const timer = window.setInterval(() => {
      setTurns(current =>
        current.map(turn => {
          if (turn.id !== activeId || turn.phase !== 'streaming') return turn;
          const text = reply.slice(0, turn.text.length + 12);
          return { ...turn, text, phase: text === reply ? 'complete' : 'streaming' };
        }),
      );
    }, 80);
    return () => window.clearInterval(timer);
  }, [activeId, phase]);

  function transitionTurn(id: string, from: Phase, to: Phase, answer?: string) {
    setTurns(current =>
      current.map(turn =>
        turn.id === id && turn.phase === from ? { ...turn, phase: to, answer: answer ?? turn.answer } : turn,
      ),
    );
  }

  function sendMessage(prompt: string, files: ChatFile[]) {
    if (busy || (!prompt.trim() && files.length === 0)) return;
    const messageId = crypto.randomUUID();
    setTurns(current => {
      if (current.at(-1)?.phase === 'streaming') return current;
      return [...current, { id: messageId, prompt: prompt.trim(), files, phase: 'streaming', text: '' }];
    });
  }

  return { turns, phase, busy, sendMessage, transitionTurn };
}
