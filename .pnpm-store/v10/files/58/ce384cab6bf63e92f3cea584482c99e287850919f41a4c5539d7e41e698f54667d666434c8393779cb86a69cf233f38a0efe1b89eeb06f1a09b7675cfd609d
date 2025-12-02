import { screen } from '@testing-library/react';

import { customRender } from 'test/render';

import { Button } from './Button';

let button: HTMLButtonElement;

describe('when rendered without props', () => {
  beforeEach(() => {
    customRender(<Button className="foo" style={{ color: 'blue' }} />);
    button = screen.getByRole('button');
  });
  test('should render a button with type "button"', () => {
    expect(button).toHaveAttribute('type', 'button');
  });
  test('should render a button with the button class name', () => {
    expect(button).toHaveClass('rdp-button');
  });
  test('should render a button with the reset class name', () => {
    expect(button).toHaveClass('rdp-button_reset');
  });
  test('should add the class name', () => {
    expect(button).toHaveClass('foo');
  });
  test('should apply the style', () => {
    expect(button).toHaveStyle({ color: 'blue' });
  });
});

describe('when using class names and styles from context', () => {
  beforeEach(() => {
    customRender(<Button />, {
      classNames: { button: 'foo' },
      styles: { button: { color: 'red' } }
    });
    button = screen.getByRole('button');
  });
  test('should apply the style', () => {
    expect(button).toHaveStyle({ color: 'red' });
  });
  test('should apply the class name', () => {
    expect(button).toHaveClass('foo');
  });
});
