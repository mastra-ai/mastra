export function splitMarkdownIntoChunks(markdown: string, maxTokens: number = 8190): string[] {
    const tokens = markdown.split(/\s+/); // Split by whitespace to tokenize
    const chunks: string[] = [];
    let currentChunk: string[] = [];
  
    for (const token of tokens) {
        if ((currentChunk.join(' ').length + token.length + 1) > maxTokens) {
            // If adding the next token exceeds the limit, push the current chunk and reset
            chunks.push(currentChunk.join(' '));
            currentChunk = [token]; // Start a new chunk with the current token
        } else {
            // Otherwise, add the token to the current chunk
            currentChunk.push(token);
        }
    }
  
    // Add any remaining tokens as the last chunk
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }
  
    return chunks;
  }