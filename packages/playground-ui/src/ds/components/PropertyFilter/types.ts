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
      /** Single-select only. When true, omit the trailing "Any" radio — used for view-toggle
       *  fields that are always one of the listed options (no neutral state). */
      omitAnyOption?: boolean;
      /** Single-select only. Pre-selects this option in PickMultiPanel when no token exists
       *  yet — used for view-toggle fields whose "no token" state still corresponds to a
       *  concrete value (the default). Does NOT create a token implicitly. */
      defaultValue?: string;
    };

export type PropertyFilterToken = {
  fieldId: string;
  value: string | string[];
};
