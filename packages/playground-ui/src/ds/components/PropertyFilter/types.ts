export type PropertyFilterOption = {
  label: string;
  value: string;
};

export type PropertyFilterField =
  | {
      id: string;
      label: string;
      kind: 'text';
      placeholder?: string;
      options?: PropertyFilterOption[];
      supportsSuggestions?: boolean;
      emptyText?: string;
    }
  | {
      id: string;
      label: string;
      kind: 'multi-select';
      placeholder?: string;
      options?: PropertyFilterOption[];
      supportsSuggestions?: boolean;
      emptyText?: string;
    }
  | {
      id: string;
      label: string;
      kind: 'pick-multi';
      options: PropertyFilterOption[];
      placeholder?: string;
      emptyText?: string;
      multi?: boolean;
      searchable?: boolean;
      /** When true, PickMultiPanel renders a "Loading options…" message instead of the list. */
      isLoading?: boolean;
    };

export type PropertyFilterToken = {
  fieldId: string;
  value: string | string[];
};
