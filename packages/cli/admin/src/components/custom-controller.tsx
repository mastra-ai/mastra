'use client';

import React from 'react';
import {
  Control,
  ControllerFieldState,
  ControllerRenderProps,
  useController,
  UseFormStateReturn,
} from 'react-hook-form';

export const CustomController = ({
  name,
  control,
  defaultValue,
  render,
}: {
  name: string;
  control: Control<any>;
  defaultValue?: any;
  render: ({
    field,
    fieldState,
    formState,
  }: {
    field: ControllerRenderProps<any, string>;
    fieldState: ControllerFieldState;
    formState: UseFormStateReturn<any>;
  }) => React.ReactElement;
}) => {
  const { field, fieldState, formState } = useController({
    name,
    control,
    defaultValue,
  });

  return render({ field, fieldState, formState });
};
