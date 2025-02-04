type BubbleStyle = 'simple' | 'rounded';

interface BubbleOptions {
  style?: BubbleStyle;
  maxWidth?: number;
}

interface BubbleCharacters {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}

class MessageBubble {
  private readonly defaultMaxWidth = 80;
  private readonly defaultStyle: BubbleStyle = 'simple';

  private readonly styleCharacters: Record<BubbleStyle, BubbleCharacters> = {
    rounded: {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│',
    },
    simple: {
      topLeft: '+',
      topRight: '+',
      bottomLeft: '+',
      bottomRight: '+',
      horizontal: '-',
      vertical: '|',
    },
  };

  private wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const rawLines = text.split('\n');

    rawLines.forEach((line: string) => {
      const isListItem = line.trim().match(/^[-*•]\s/);
      const indent = isListItem ? 2 : 0;
      const availableWidth = maxWidth - indent;

      if (line.trim() === '') {
        lines.push('');
        return;
      }

      let currentLine = '';
      const words = line.trim().split(' ');

      words.forEach((word: string) => {
        if (currentLine === '' && isListItem) {
          currentLine = '  ' + word;
        } else if (currentLine === '') {
          currentLine = word;
        } else if ((currentLine + ' ' + word).length <= maxWidth) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = isListItem ? '  ' + word : word;
        }
      });

      if (currentLine) {
        lines.push(currentLine);
      }
    });

    return lines;
  }

  private validateOptions(options: BubbleOptions): void {
    if (options.maxWidth && options.maxWidth < 20) {
      throw new Error('maxWidth must be at least 20 characters');
    }
    if (options.style && !this.styleCharacters[options.style]) {
      throw new Error('Invalid style. Must be either "simple" or "rounded"');
    }
  }

  public print(message: string, options: BubbleOptions = {}): void {
    this.validateOptions(options);

    const maxWidth = options.maxWidth || this.defaultMaxWidth;
    const style = options.style || this.defaultStyle;
    const chars = this.styleCharacters[style];

    // Process and wrap the text
    const wrappedLines = this.wrapText(message, maxWidth - 4);
    const contentWidth = Math.min(maxWidth - 4, Math.max(...wrappedLines.map(line => line.length)));

    // Create borders
    const topBorder = chars.topLeft + chars.horizontal.repeat(contentWidth + 2) + chars.topRight;
    const bottomBorder = chars.bottomLeft + chars.horizontal.repeat(contentWidth + 2) + chars.bottomRight;

    // Print the bubble
    console.log(topBorder);
    wrappedLines.forEach(line => {
      console.log(`${chars.vertical} ${line.padEnd(contentWidth)} ${chars.vertical}`);
    });
    console.log(bottomBorder);
    console.log('  ╰╯');
  }
}

// Example usage:
export const bubble = new MessageBubble();
