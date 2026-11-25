import { useBoundProp } from '@json-render/react';
import type { Components } from '@json-render/react';
import type { StudioCatalog } from '@mastra/json-render/studio';
import { useContext } from 'react';
import { GenUiInteractiveContext } from './interactive-context';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Card, CardContent, CardDescription, CardTitle } from '@/ds/components/Card';
import { Checkbox } from '@/ds/components/Checkbox';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { Meter } from '@/ds/components/Meter';
import { Notice } from '@/ds/components/Notice';
import { SectionDivider } from '@/ds/components/Section/section-divider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Tbody, Th, Thead, Row, Table, TxtCell } from '@/ds/components/Table';
import { Txt } from '@/ds/components/Txt';
import { IconArrowDownRight } from '@/ds/icons/central/IconArrowDownRight';
import { IconArrowRight } from '@/ds/icons/central/IconArrowRight';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

const stackGap = { sm: 'gap-2', md: 'gap-4', lg: 'gap-6' } as const;
const stackAlign = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
} as const;
const gridColumns = {
  1: '',
  2: '@md:grid-cols-2',
  3: '@md:grid-cols-2 @2xl:grid-cols-3',
  4: '@md:grid-cols-2 @2xl:grid-cols-4',
} as const;
const headingVariant = { lg: 'title', md: 'heading', sm: 'subheading' } as const;
const headingElement = { lg: 'h3', md: 'h4', sm: 'h5' } as const;
const trendIcon = { up: IconArrowUpRight, down: IconArrowDownRight, flat: IconArrowRight } as const;

/** Draws every `studioCatalog` component with Studio's design system. */
export const studioComponents: Components<StudioCatalog> = {
  Stack: ({ props, children }) => (
    <div
      className={cn(
        'flex min-w-0',
        props.direction === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col',
        stackGap[props.gap ?? 'md'],
        props.align && stackAlign[props.align],
      )}
    >
      {children}
    </div>
  ),
  Grid: ({ props, children }) => (
    <div className={cn('grid min-w-0 grid-cols-1 gap-4', gridColumns[props.columns as keyof typeof gridColumns])}>
      {children}
    </div>
  ),
  Card: ({ props, children }) => (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {(props.title || props.description) && (
          <div className="flex flex-col gap-1">
            {props.title && <CardTitle>{props.title}</CardTitle>}
            {props.description && <CardDescription>{props.description}</CardDescription>}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  ),
  Heading: ({ props }) => {
    const size = props.size ?? 'md';
    return (
      <Txt as={headingElement[size]} variant={headingVariant[size]} tone="ink">
        {props.text}
      </Txt>
    );
  },
  Text: ({ props }) => (
    <Txt variant="body" tone={props.tone === 'muted' ? 'muted' : 'ink'}>
      {props.text}
    </Txt>
  ),
  Badge: ({ props }) => <Badge variant={props.variant ?? 'neutral'}>{props.text}</Badge>,
  Stat: ({ props }) => {
    const TrendIcon = props.trend && trendIcon[props.trend];
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <Txt as="span" variant="label" tone="muted">
          {props.label}
        </Txt>
        <Txt as="span" variant="display" tone="ink" className="tabular-nums">
          {props.value}
        </Txt>
        {(props.detail || TrendIcon) && (
          <Txt as="span" variant="caption" tone="muted" className="flex items-center gap-1">
            {TrendIcon && (
              <Icon size="sm">
                <TrendIcon aria-hidden />
              </Icon>
            )}
            {props.detail}
          </Txt>
        )}
      </div>
    );
  },
  Table: ({ props }) => {
    // While the spec streams in, the table can arrive before its columns and rows.
    const columns = props.columns ?? [];
    const rows = props.rows ?? [];
    return (
      <Table>
        <Thead>
          {columns.map((column, index) => (
            <Th key={index}>{column}</Th>
          ))}
        </Thead>
        <Tbody>
          {rows.map((cells, rowIndex) => (
            <Row key={rowIndex}>
              {columns.map((_, cellIndex) => (
                <TxtCell key={cellIndex}>{cells?.[cellIndex] ?? ''}</TxtCell>
              ))}
            </Row>
          ))}
        </Tbody>
      </Table>
    );
  },
  List: ({ props }) => {
    const ListElement = props.ordered ? 'ol' : 'ul';
    return (
      <ListElement className={cn('flex flex-col gap-1 ps-5', props.ordered ? 'list-decimal' : 'list-disc')}>
        {props.items.map((item, index) => (
          <li key={index}>
            <Txt as="span" variant="body" tone="ink">
              {item}
            </Txt>
          </li>
        ))}
      </ListElement>
    );
  },
  Progress: ({ props }) => (
    <div className="flex min-w-0 flex-col gap-1">
      <Meter value={props.value} max={100} label={props.label} aria-label={props.label} />
      {props.detail && (
        <Txt as="span" variant="caption" tone="muted">
          {props.detail}
        </Txt>
      )}
    </div>
  ),
  Notice: ({ props }) => (
    <Notice variant={props.variant ?? 'info'} title={props.title}>
      <Notice.Message>{props.text}</Notice.Message>
    </Notice>
  ),
  Separator: () => <SectionDivider />,
  Button: ({ props, emit }) => {
    const interactive = useContext(GenUiInteractiveContext);
    return (
      <Button variant={props.variant ?? 'default'} disabled={!interactive} onClick={() => emit('press')}>
        {props.label}
      </Button>
    );
  },
  Input: ({ props, bindings }) => {
    const interactive = useContext(GenUiInteractiveContext);
    const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);
    return (
      <Field>
        <FieldLabel>{props.label}</FieldLabel>
        <Input
          type={props.type ?? 'text'}
          placeholder={props.placeholder}
          value={value ?? ''}
          disabled={!interactive}
          onChange={event => setValue(event.target.value)}
        />
      </Field>
    );
  },
  Select: ({ props, bindings }) => {
    const interactive = useContext(GenUiInteractiveContext);
    const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);
    return (
      <Field>
        <FieldLabel>{props.label}</FieldLabel>
        <Select value={value ?? null} onValueChange={setValue} disabled={!interactive}>
          <SelectTrigger>
            <SelectValue placeholder={props.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {props.options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  },
  Checkbox: ({ props, bindings }) => {
    const interactive = useContext(GenUiInteractiveContext);
    const [checked, setChecked] = useBoundProp<boolean>(props.checked, bindings?.checked);
    return (
      <Field orientation="horizontal" className="gap-1.5">
        <Checkbox
          checked={checked ?? false}
          disabled={!interactive}
          onCheckedChange={next => setChecked(next === true)}
        />
        <FieldLabel>{props.label}</FieldLabel>
      </Field>
    );
  },
};
