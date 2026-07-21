const modeColors: Record<string, { background: string; foreground: string }> = {
  build: { background: '#16c858', foreground: '#111827' },
  plan: { background: '#7f45e0', foreground: '#ffffff' },
  fast: { background: '#fdac53', foreground: '#111827' },
};

export function getModeColor(modeId: string | undefined): string | undefined {
  return modeId ? modeColors[modeId.toLowerCase()]?.background : undefined;
}

export function getModeForegroundColor(modeId: string | undefined): string | undefined {
  return modeId ? modeColors[modeId.toLowerCase()]?.foreground : undefined;
}
