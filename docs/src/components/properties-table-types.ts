export interface Parameter {
  name: string;
  type: string;
  isOptional?: boolean;
  description: string;
}

export interface Property {
  type: string;
  parameters: Parameter[];
}

export interface ContentItem {
  name: string;
  type: string;
  isOptional?: boolean;
  description: string;
  properties?: Property[];
  defaultValue?: string;
  isExperimental?: boolean;
  deprecated?: string;
}
