---
'@mastra/playground-ui': patch
---

Fixed the multiple-select `Combobox` so `allowCustomValue` and `onInputValueChange` work as they do on the single select. Typed text is offered as an option and becomes a chip when picked. A selected value that `options` does not list now keeps its chip and stays in the value when another option is picked, with or without `allowCustomValue`. Such a value is also shown in the popup, where it can be unticked. With `allowCustomValue`, typing the exact value of an option whose label differs now offers that option, on single and multiple selects.

```tsx
const [selected, setSelected] = useState<string[]>([]);

<Combobox multiple allowCustomValue options={models} value={selected} onValueChange={setSelected} />;
```
