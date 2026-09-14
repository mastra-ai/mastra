import { Plus, Search } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/ds/components/Button';
import { Checkbox } from '@/ds/components/Checkbox';
import { Input } from '@/ds/components/Input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ds/components/InputGroup';
import { Label } from '@/ds/components/Label';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { Slider } from '@/ds/components/Slider';
import { Switch } from '@/ds/components/Switch';
import { Textarea } from '@/ds/components/Textarea';

export function FocusInputs() {
  return (
    <div className="grid gap-5">
      <Input aria-label="Agent name" placeholder="Agent name" />
      <Input variant="outline" aria-label="Outline input" placeholder="Outline input" />
      <Input variant="unstyled" aria-label="Unstyled input" placeholder="Unstyled input" />
      <Input error aria-label="Invalid input" defaultValue="Invalid value" />
      <Input disabled aria-label="Disabled input" placeholder="Disabled input" />
      <div className="grid gap-4">
        {(['xs', 'sm', 'md', 'lg'] as const).map(size => (
          <Input key={size} size={size} aria-label={`${size} input`} placeholder={`${size} input`} />
        ))}
      </div>
    </div>
  );
}

export function FocusTextareas() {
  return (
    <div className="grid gap-5">
      <Textarea aria-label="Instructions" placeholder="Instructions" />
      <Textarea variant="outline" aria-label="Outline instructions" placeholder="Outline instructions" />
      <Textarea variant="unstyled" aria-label="Unstyled instructions" placeholder="Unstyled instructions" />
      <Textarea error aria-label="Invalid instructions" defaultValue="Invalid instructions" />
      <Textarea disabled aria-label="Disabled instructions" placeholder="Disabled instructions" />
    </div>
  );
}

export function FocusInputGroups() {
  return (
    <div className="grid gap-5">
      {(['default', 'filled', 'outline'] as const).map(variant => (
        <InputGroup key={variant} variant={variant}>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput aria-label={`${variant} search`} placeholder={`${variant} search`} />
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label={`${variant} add filter`}>
              <Plus />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      ))}
    </div>
  );
}

export function FocusButtons() {
  return (
    <div className="grid gap-6">
      {(['default', 'primary', 'outline', 'ghost', 'destructive', 'destructive-ghost'] as const).map(variant => (
        <div key={variant} className="flex flex-wrap items-center gap-5">
          <Button variant={variant}>{variant}</Button>
          <Button variant={variant} size="icon-md" aria-label={`${variant} add`}>
            <Plus />
          </Button>
          <Button variant={variant} disabled>
            Disabled
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-4">
        {(['xs', 'sm', 'md', 'lg'] as const).map(size => (
          <Button key={size} size={size}>
            {size}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function FocusCheckboxes() {
  const id = useId();
  return (
    <div className="flex flex-wrap gap-6 py-2">
      <Label className="flex items-center gap-3" htmlFor={`${id}-unchecked`}>
        <Checkbox id={`${id}-unchecked`} /> Unchecked
      </Label>
      <Label className="flex items-center gap-3" htmlFor={`${id}-checked`}>
        <Checkbox id={`${id}-checked`} defaultChecked /> Checked
      </Label>
      <Checkbox aria-label="Indeterminate selection" indeterminate />
      <Checkbox aria-label="Disabled selection" disabled />
    </div>
  );
}

export function FocusSwitches() {
  const id = useId();
  return (
    <div className="flex flex-wrap gap-6 py-2">
      <Label className="flex items-center gap-3" htmlFor={`${id}-off`}>
        <Switch id={`${id}-off`} /> Off
      </Label>
      <Label className="flex items-center gap-3" htmlFor={`${id}-on`}>
        <Switch id={`${id}-on`} defaultChecked /> On
      </Label>
      <Switch aria-label="Disabled switch" disabled />
    </div>
  );
}

export function FocusRadios() {
  const id = useId();
  return (
    <RadioGroup defaultValue="automatic" aria-label="Execution mode" className="flex flex-wrap gap-6 py-2">
      {['automatic', 'manual', 'disabled'].map(value => (
        <Label key={value} className="flex items-center gap-3" htmlFor={`${id}-${value}`}>
          <RadioGroupItem id={`${id}-${value}`} value={value} disabled={value === 'disabled'} /> {value}
        </Label>
      ))}
    </RadioGroup>
  );
}

export function FocusSliders() {
  return (
    <div className="grid gap-6 px-4">
      <Slider aria-label="Temperature" defaultValue={[40]} />
      <Slider aria-label="Range" defaultValue={[25, 75]} />
      <Slider aria-label="Disabled range" disabled defaultValue={[25, 75]} />
      <Slider aria-label="Vertical temperature" defaultValue={[60]} orientation="vertical" className="h-36 w-12" />
    </div>
  );
}
