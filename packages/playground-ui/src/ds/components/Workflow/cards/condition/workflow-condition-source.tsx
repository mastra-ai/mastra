import { useEffect, useState } from 'react';
import { Code } from '@/ds/components/Code';
import { formatTypeScript } from '@/utils/formatting';

const MAX_FORMATTED_SOURCE_CHARS = 10_000;

export function WorkflowConditionSource({ source }: { source: string }) {
  if (source.length > MAX_FORMATTED_SOURCE_CHARS) return <Code code={source} />;
  return <FormattedConditionSource key={source} source={source} />;
}

function FormattedConditionSource({ source }: { source: string }) {
  const [formatted, setFormatted] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    formatTypeScript(source)
      .then(expression => {
        if (!cancelled) setFormatted(expression.trim());
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [source]);

  return <Code code={formatted ?? source} lang={formatted === undefined ? undefined : 'typescript'} />;
}
