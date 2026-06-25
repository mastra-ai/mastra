import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { Marked } from 'marked';
import { useMemo } from 'react';

// Register commonly-used languages (tree-shakeable vs importing the full bundle).
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', shell);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('css', css);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('json', json);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);

const marked = new Marked({
  breaks: true,
  gfm: true,
});

// Custom renderer for code blocks with syntax highlighting.
marked.use({
  renderer: {
    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : undefined;
      const highlighted = language ? hljs.highlight(text, { language }).value : hljs.highlightAuto(text).value;
      return `<pre class="code-block"><code class="hljs${language ? ` language-${language}` : ''}">${highlighted}</code></pre>`;
    },
    codespan({ text }) {
      return `<code class="inline-code">${text}</code>`;
    },
  },
});

interface MarkdownProps {
  children: string;
  className?: string;
}

/**
 * Renders a markdown string as formatted HTML with syntax-highlighted code
 * blocks. Content comes from our own agent (not arbitrary user input), so
 * `dangerouslySetInnerHTML` is acceptable here.
 */
export function Markdown({ children, className }: MarkdownProps) {
  const html = useMemo(() => {
    try {
      return marked.parse(children) as string;
    } catch {
      return children;
    }
  }, [children]);

  return <div className={`markdown ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
