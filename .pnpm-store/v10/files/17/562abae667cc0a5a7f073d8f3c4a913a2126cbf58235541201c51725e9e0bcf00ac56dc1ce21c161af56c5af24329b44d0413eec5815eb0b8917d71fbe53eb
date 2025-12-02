import { forwardRef } from 'react';

import { useDayPicker } from 'contexts/DayPicker';

/** The props for the {@link Button} component. */
export type ButtonProps = JSX.IntrinsicElements['button'];

/** Render a button HTML element applying the reset class name. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const { classNames, styles } = useDayPicker();

    const classNamesArr = [classNames.button_reset, classNames.button];
    if (props.className) {
      classNamesArr.push(props.className);
    }
    const className = classNamesArr.join(' ');

    const style = { ...styles.button_reset, ...styles.button };
    if (props.style) {
      Object.assign(style, props.style);
    }

    return (
      <button
        {...props}
        ref={ref}
        type="button"
        className={className}
        style={style}
      />
    );
  }
);
