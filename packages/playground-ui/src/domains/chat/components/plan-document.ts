interface PlanDocument {
  title: string;
  body: string;
}

export function getPlanDocument(content: string): PlanDocument {
  const headingMatch = /^#\s+(.+)\r?$/m.exec(content);

  if (!headingMatch || headingMatch[1] === undefined) {
    return { title: 'Plan', body: content };
  }

  const heading = headingMatch[0];
  const headingIndex = headingMatch.index;
  const body = `${content.slice(0, headingIndex)}${content.slice(headingIndex + heading.length)}`.trimStart();

  return { title: headingMatch[1].trim(), body };
}
