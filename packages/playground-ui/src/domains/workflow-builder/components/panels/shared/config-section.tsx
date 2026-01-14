import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfigSectionProps {
  /** Section title */
  title: string;
  /** Optional description shown when collapsed */
  description?: string;
  /** Whether the section starts expanded */
  defaultExpanded?: boolean;
  /** Section content */
  children: React.ReactNode;
  /** Optional icon to show before title */
  icon?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show a border at the top */
  border?: boolean;
}

/**
 * Collapsible configuration section for property panels.
 * Provides consistent styling and behavior across all config panels.
 */
export function ConfigSection({
  title,
  description,
  defaultExpanded = true,
  children,
  icon,
  className,
  border = false,
}: ConfigSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggle = useCallback(() => setIsExpanded(prev => !prev), []);

  return (
    <div className={cn(border && 'border-t border-border1 pt-4', className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'flex items-center gap-2 w-full text-left',
          'hover:bg-surface2/50 -mx-1 px-1 py-1 rounded transition-colors',
        )}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-icon3 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-icon3 flex-shrink-0" />
        )}

        {icon && <span className="text-icon4 flex-shrink-0">{icon}</span>}

        <span className="text-xs text-icon5 font-medium flex-1">{title}</span>
      </button>

      {!isExpanded && description && <p className="text-[10px] text-icon3 ml-6 mt-1">{description}</p>}

      <div
        className={cn(
          'ml-6 overflow-hidden transition-all duration-200',
          isExpanded ? 'mt-3 opacity-100' : 'mt-0 max-h-0 opacity-0',
        )}
      >
        {isExpanded && children}
      </div>
    </div>
  );
}

export interface ConfigFieldProps {
  /** Field label */
  label: string;
  /** Help text below the input */
  hint?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** The input element */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Consistent field wrapper for config panel inputs.
 * Handles label, hints, errors, and spacing.
 */
export function ConfigField({ label, hint, required, error, children, className }: ConfigFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-xs text-icon5 flex items-center gap-1">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>

      {children}

      {hint && !error && <p className="text-[10px] text-icon3">{hint}</p>}

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}

export interface ConfigInfoBoxProps {
  /** Content to display */
  children: React.ReactNode;
  /** Visual variant */
  variant?: 'info' | 'warning' | 'success' | 'neutral';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Styled info box for displaying contextual information in config panels.
 */
export function ConfigInfoBox({ children, variant = 'neutral', className }: ConfigInfoBoxProps) {
  const variantStyles = {
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    success: 'bg-green-500/10 border-green-500/20 text-green-400',
    neutral: 'bg-surface3 border-border1 text-icon4',
  };

  return <div className={cn('p-3 rounded-lg border text-xs', variantStyles[variant], className)}>{children}</div>;
}

export interface ConfigCodeBlockProps {
  /** Code to display */
  children: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Styled code block for displaying references, paths, etc.
 */
export function ConfigCodeBlock({ children, className }: ConfigCodeBlockProps) {
  return (
    <code className={cn('block text-xs font-mono text-icon6 bg-surface4 px-2 py-1 rounded', className)}>
      {children}
    </code>
  );
}
