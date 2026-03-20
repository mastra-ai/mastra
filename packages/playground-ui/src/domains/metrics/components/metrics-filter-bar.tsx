import { useState, useEffect } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { Button } from '@/ds/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { useMetrics, DATE_PRESETS } from '../hooks/use-metrics';
import type { DatePreset, Comparator } from '../hooks/use-metrics';

const FILTER_COLUMNS = [
  {
    field: 'Environment',
    plural: 'environments',
    values: ['Studio Cloud', 'Production', 'Staging', 'Dev', 'CI / Preview'],
  },
  {
    field: 'Agents',
    plural: 'agents',
    values: [
      'support-agent',
      'research-agent',
      'code-reviewer',
      'onboarding-agent',
      'data-analyst',
      'email-drafter',
      'qa-tester',
    ],
  },
  {
    field: 'Models',
    plural: 'models',
    values: [
      'gpt-4o',
      'gpt-4o-mini',
      'claude-3.5-sonnet',
      'claude-3-haiku',
      'deepseek-v3',
      'llama-3.1-70b',
      'mistral-large',
      'gemini-1.5-pro',
    ],
  },
  {
    field: 'Tools',
    plural: 'tools',
    values: ['web-search', 'calculator', 'file-reader', 'api-caller', 'db-query', 'code-interpreter', 'image-gen'],
  },
  {
    field: 'Workflows',
    plural: 'workflows',
    values: [
      'onboarding-flow',
      'review-pipeline',
      'data-ingestion',
      'report-generation',
      'user-migration',
      'nightly-sync',
      'alert-pipeline',
    ],
  },
];

const DATE_FORMAT = 'MM/dd/yyyy';

export function DateRangePickerButton() {
  const { datePreset, setDatePreset, customRange, setCustomRange, dateRangeLabel } = useMetrics();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(datePreset === 'custom');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');

  useEffect(() => {
    setFromInput(customRange?.from ? format(customRange.from, DATE_FORMAT) : '');
    setToInput(customRange?.to ? format(customRange.to, DATE_FORMAT) : '');
  }, [customRange]);

  useEffect(() => {
    if (!open && datePreset !== 'custom') {
      setShowCustom(false);
    }
  }, [open, datePreset]);

  function selectPreset(value: DatePreset) {
    setDatePreset(value);
    setCustomRange(undefined);
    setOpen(false);
  }

  function handleFromBlur() {
    const parsed = parse(fromInput, DATE_FORMAT, new Date());
    if (isValid(parsed)) {
      setCustomRange({ from: parsed, to: customRange?.to });
    }
  }

  function handleToBlur() {
    const parsed = parse(toInput, DATE_FORMAT, new Date());
    if (isValid(parsed)) {
      setCustomRange({ from: customRange?.from, to: parsed });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button>
          {dateRangeLabel}
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {!showCustom ? (
          <div className="flex flex-col py-1">
            {DATE_PRESETS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => selectPreset(value)}
                className={`px-4 py-2 text-left text-sm hover:bg-white/15 transition-colors rounded-md ${
                  datePreset === value ? 'text-icon6 font-medium' : 'text-icon3'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="border-t border-border1 my-1" />
            <button
              onClick={() => {
                setShowCustom(true);
                setDatePreset('custom');
              }}
              className={`px-4 py-2 text-left text-sm hover:bg-white/15 transition-colors rounded-md ${
                datePreset === 'custom' ? 'text-icon6 font-medium' : 'text-icon3'
              }`}
            >
              Custom range...
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 px-3 pt-3">
              <div className="flex-1">
                <label className="text-[10px] font-medium text-icon3 uppercase tracking-wider mb-1 block">Start</label>
                <input
                  placeholder={DATE_FORMAT.toLowerCase()}
                  value={fromInput}
                  onChange={e => setFromInput(e.target.value)}
                  onBlur={handleFromBlur}
                  className="h-8 w-full text-xs font-mono rounded-md border border-border1 bg-transparent px-2 outline-none focus:border-icon3"
                />
              </div>
              <span className="text-icon3 mt-4">&ndash;</span>
              <div className="flex-1">
                <label className="text-[10px] font-medium text-icon3 uppercase tracking-wider mb-1 block">End</label>
                <input
                  placeholder={DATE_FORMAT.toLowerCase()}
                  value={toInput}
                  onChange={e => setToInput(e.target.value)}
                  onBlur={handleToBlur}
                  className="h-8 w-full text-xs font-mono rounded-md border border-border1 bg-transparent px-2 outline-none focus:border-icon3"
                />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border1 px-3 py-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setShowCustom(false);
                  if (!customRange?.from) {
                    setDatePreset('24h');
                  }
                }}
              >
                &larr; Presets
              </Button>
              <Button
                size="sm"
                className="text-xs"
                onClick={() => setOpen(false)}
                disabled={!customRange?.from || !customRange?.to}
              >
                Apply
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function UnifiedFilterDropdown() {
  const { filterGroups, setFilterGroups } = useMetrics();
  const [open, setOpen] = useState(false);
  const [filterColumnSearch, setFilterColumnSearch] = useState('');
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [filterValueSearch, setFilterValueSearch] = useState('');

  let nextFilterId = 0;
  const genFilterId = () => `fg_${Date.now()}_${nextFilterId++}`;

  const addFilterValue = (field: string, value: string) => {
    setFilterGroups(prev => {
      const existingIdx = prev.findLastIndex(g => g.field === field);
      if (existingIdx !== -1) {
        const group = prev[existingIdx];
        if (group.values.includes(value)) {
          const newValues = group.values.filter(v => v !== value);
          if (newValues.length === 0) return prev.filter((_, i) => i !== existingIdx);
          return prev.map((g, i) => (i === existingIdx ? { ...g, values: newValues } : g));
        }
        return prev.map((g, i) => (i === existingIdx ? { ...g, values: [...g.values, value] } : g));
      }
      return [...prev, { id: genFilterId(), field, comparator: 'is' as Comparator, values: [value] }];
    });
  };

  const activeFilterCount = filterGroups.length;

  return (
    <Popover
      open={open}
      onOpenChange={o => {
        setOpen(o);
        if (!o) {
          setExpandedField(null);
          setFilterColumnSearch('');
          setFilterValueSearch('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-[11px] px-2.5">
          <Filter className="size-3" />
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-0.5 text-[9px] px-1 py-0 rounded bg-white/10">{activeFilterCount}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-0">
        {!expandedField ? (
          <div className="py-1">
            <div className="px-3 pb-1.5 pt-1 border-b border-border1 mb-1">
              <input
                className="w-full text-xs bg-transparent outline-none placeholder:text-icon2/50 pb-1"
                placeholder="Search filters..."
                value={filterColumnSearch}
                onChange={e => setFilterColumnSearch(e.target.value)}
              />
            </div>
            {FILTER_COLUMNS.filter(col => col.field.toLowerCase().includes(filterColumnSearch.toLowerCase())).map(
              col => (
                <button
                  key={col.field}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-xs hover:bg-white/10 transition-colors"
                  onClick={() => {
                    setExpandedField(col.field);
                    setFilterValueSearch('');
                  }}
                >
                  {col.field}
                  <ChevronDown className="size-3 -rotate-90 text-icon2" />
                </button>
              ),
            )}
          </div>
        ) : (
          <div className="py-1">
            <div className="px-3 pb-1.5 pt-1 border-b border-border1 mb-1 flex items-center gap-2">
              <button className="text-xs text-icon2 hover:text-icon6" onClick={() => setExpandedField(null)}>
                &larr;
              </button>
              <input
                className="w-full text-xs bg-transparent outline-none placeholder:text-icon2/50 pb-1"
                placeholder={`Search ${FILTER_COLUMNS.find(c => c.field === expandedField)?.plural}...`}
                value={filterValueSearch}
                onChange={e => setFilterValueSearch(e.target.value)}
              />
            </div>
            {FILTER_COLUMNS.find(c => c.field === expandedField)
              ?.values.filter(val => val.toLowerCase().includes(filterValueSearch.toLowerCase()))
              .map(val => {
                const isActive = filterGroups.some(g => g.field === expandedField && g.values.includes(val));
                return (
                  <button
                    key={val}
                    className="flex items-center justify-between w-full px-3 py-1.5 text-xs hover:bg-white/10 transition-colors"
                    onClick={() => addFilterValue(expandedField!, val)}
                  >
                    <span>{val}</span>
                    <span
                      className={`size-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-opacity ${
                        isActive ? 'opacity-100 bg-white/20 border-icon3' : 'opacity-30 border-icon3'
                      }`}
                    >
                      {isActive && <span className="text-[10px]">{'\u2713'}</span>}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilterPills() {
  const { filterGroups, setFilterGroups } = useMetrics();

  if (filterGroups.length === 0) return null;

  const removeFilterGroup = (id: string) => {
    setFilterGroups(prev => prev.filter(g => g.id !== id));
  };

  const setGroupComparator = (id: string, comparator: Comparator) => {
    setFilterGroups(prev => prev.map(g => (g.id === id ? { ...g, comparator } : g)));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap mt-2">
      {filterGroups.map(group => {
        const col = FILTER_COLUMNS.find(c => c.field === group.field);
        const displayValue =
          group.values.length > 1 ? `${group.values.length} ${col?.plural ?? 'values'}` : group.values[0];
        return (
          <div
            key={group.id}
            className="flex items-center h-7 rounded-md border border-border1 bg-white/5 text-xs overflow-hidden"
          >
            <span className="text-icon3 px-2">{group.field}</span>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-icon2 border-x border-border1 px-1.5 h-full hover:bg-white/10 hover:text-icon5 transition-colors cursor-pointer whitespace-nowrap">
                  {group.values.length > 1 ? `${group.comparator} any of` : group.comparator}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-24 p-1">
                {(['is', 'is not'] as const).map(comp => (
                  <button
                    key={comp}
                    className="w-full text-left text-xs px-2 py-1.5 hover:bg-white/10 rounded transition-colors"
                    onClick={() => setGroupComparator(group.id, comp)}
                  >
                    {comp}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <span className="text-icon6 px-2">{displayValue}</span>
            <button
              onClick={() => removeFilterGroup(group.id)}
              className="border-l border-border1 px-1.5 h-full text-icon2 hover:text-icon6 hover:bg-white/10 transition-colors"
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
      <Button variant="ghost" size="sm" className="h-7 text-[11px] text-icon3 px-2" onClick={() => setFilterGroups([])}>
        Clear all
      </Button>
    </div>
  );
}

export function MetricsFilterBar() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <UnifiedFilterDropdown />
        <DateRangePickerButton />
      </div>
      <FilterPills />
    </>
  );
}
