import './composer.css';

const modeColorClassNames: Record<string, string> = {
  build: 'chat-mode-build',
  plan: 'chat-mode-plan',
  fast: 'chat-mode-fast',
};

export function getModeColorClass(modeId: string | undefined): string | undefined {
  return modeId ? modeColorClassNames[modeId.toLowerCase()] : undefined;
}
