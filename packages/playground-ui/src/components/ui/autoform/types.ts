import { ExtendableAutoFormProps } from "@autoform/react";
import { FieldValues } from "react-hook-form";

export interface AutoFormProps<T extends FieldValues>
  extends ExtendableAutoFormProps<T> {}
