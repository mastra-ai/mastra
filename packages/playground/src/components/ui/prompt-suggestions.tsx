interface PromptSuggestionsProps {
  label: string;
  append: (message: { role: 'user'; content: string }) => void;
  suggestions: string[];
}

export function PromptSuggestions({ label, append, suggestions }: PromptSuggestionsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-center text-2xl font-bold">{label}</h2>
      <div className="flex flex-col sm:flex-row gap-6 text-sm items-center justify-center">
        {suggestions.map(suggestion => (
          <button
            key={suggestion}
            onClick={() => append({ role: 'user', content: suggestion })}
            className="h-max rounded-xl border bg-transparent p-4 hover:bg-accent"
          >
            <p>{suggestion}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
