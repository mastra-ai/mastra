import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { VariableRef } from '../../types';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { cn } from '@/lib/utils';
import { useSelectedNodeDataContext } from '../../hooks/use-data-context';

export interface VariableRefInputProps {
  label?: string;
  value: VariableRef | null;
  onChange: (value: VariableRef | null) => void;
  placeholder?: string;
  className?: string;
  /** Hide autocomplete dropdown */
  disableAutocomplete?: boolean;
}

export function VariableRefInput({
  label,
  value,
  onChange,
  placeholder = 'trigger.fieldName',
  className,
  disableAutocomplete = false,
}: VariableRefInputProps) {
  const [localValue, setLocalValue] = useState(value?.$ref ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const dataContext = useSelectedNodeDataContext();

  // Filter suggestions based on current input
  const suggestions = useMemo(() => {
    if (disableAutocomplete || !localValue) {
      return dataContext.allPaths.slice(0, 10);
    }

    const searchLower = localValue.toLowerCase();
    return dataContext.allPaths
      .filter(p => p.path.toLowerCase().includes(searchLower) || p.label.toLowerCase().includes(searchLower))
      .slice(0, 10);
  }, [dataContext.allPaths, localValue, disableAutocomplete]);

  // Check if current value is valid
  const isValidPath = useMemo(() => {
    if (!localValue) return true;
    return dataContext.isValidPath(localValue);
  }, [localValue, dataContext]);

  // Update local value when external value changes
  useEffect(() => {
    setLocalValue(value?.$ref ?? '');
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      setSelectedIndex(0);

      if (!disableAutocomplete) {
        setShowSuggestions(true);
      }

      if (newValue.trim()) {
        onChange({ $ref: newValue.trim() });
      } else {
        onChange(null);
      }
    },
    [onChange, disableAutocomplete],
  );

  const handleSelectSuggestion = useCallback(
    (path: string) => {
      setLocalValue(path);
      onChange({ $ref: path });
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            handleSelectSuggestion(suggestions[selectedIndex].path);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          break;
      }
    },
    [showSuggestions, suggestions, selectedIndex, handleSelectSuggestion],
  );

  const handleFocus = useCallback(() => {
    if (!disableAutocomplete && dataContext.allPaths.length > 0) {
      setShowSuggestions(true);
    }
  }, [disableAutocomplete, dataContext.allPaths.length]);

  // Handle drag-drop from DataPreviewPanel
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const path = e.dataTransfer.getData('application/workflow-data-path');
      if (path) {
        setLocalValue(path);
        onChange({ $ref: path });
      }
    },
    [onChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label className="text-xs text-icon5">{label}</Label>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-icon3 text-sm font-mono">$</span>
        <Input
          ref={inputRef}
          value={localValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          placeholder={placeholder}
          className={cn(
            'pl-7 pr-8 font-mono text-sm',
            localValue && !isValidPath && 'border-amber-500 focus-visible:ring-amber-500/20',
          )}
        />
        {!disableAutocomplete && dataContext.allPaths.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-surface4 rounded"
          >
            <ChevronDown className={cn('w-4 h-4 text-icon3 transition-transform', showSuggestions && 'rotate-180')} />
          </button>
        )}

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface3 border border-border1 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="max-h-[200px] overflow-y-auto py-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.path}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion.path)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left',
                    'hover:bg-surface4 transition-colors',
                    index === selectedIndex && 'bg-surface4',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-icon5 truncate">{suggestion.path}</div>
                    <div className="text-[10px] text-icon3 truncate">{suggestion.label}</div>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded font-mono',
                      suggestion.type === 'string' && 'bg-green-500/20 text-green-400',
                      suggestion.type === 'number' && 'bg-blue-500/20 text-blue-400',
                      suggestion.type === 'boolean' && 'bg-amber-500/20 text-amber-400',
                      suggestion.type === 'object' && 'bg-purple-500/20 text-purple-400',
                      suggestion.type === 'array' && 'bg-pink-500/20 text-pink-400',
                      suggestion.type === 'unknown' && 'bg-gray-500/20 text-gray-400',
                    )}
                  >
                    {suggestion.type}
                  </span>
                  {localValue === suggestion.path && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Validation/hint */}
      {localValue && !isValidPath ? (
        <p className="text-[10px] text-amber-500">Path not found in available data sources</p>
      ) : (
        <p className="text-[10px] text-icon3">
          {dataContext.allPaths.length > 0
            ? `${dataContext.allPaths.length} fields available - type to search`
            : 'Reference: trigger.*, steps.stepId.*'}
        </p>
      )}
    </div>
  );
}
