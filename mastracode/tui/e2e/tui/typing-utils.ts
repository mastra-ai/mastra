export async function typeTextSlowly(
  terminal: { write: (text: string) => void },
  text: string,
  delayMs = 25,
): Promise<void> {
  for (const char of text) {
    terminal.write(char);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
