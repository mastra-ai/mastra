/* eslint-disable jest/no-conditional-expect */
import React, { useEffect, useRef } from 'react';
import renderer from 'react-test-renderer';
import { render, fireEvent, screen } from '@testing-library/react';
// import userEvent from '@testing-library/user-event';
// import '@testing-library/jest-dom';
import CodeMirror, { ReactCodeMirrorRef } from '..';

it('CodeMirror', async () => {
  const component = renderer.create(<CodeMirror />);
  let tree = component.toJSON();
  if (tree && !Array.isArray(tree)) {
    expect(tree.type).toEqual('div');
    expect(tree.props.className).toEqual('cm-theme-light');
  }
});

it('CodeMirror onChange', async () => {
  const handleChange = jest.fn((value) => {
    expect(value).toEqual('# title');
    return Array.isArray(value) ? value.join() : value;
  });
  render(<CodeMirror autoFocus value="console.log('Hello world!')" onChange={handleChange} />);
  const input = await screen.findByRole<HTMLInputElement>('textbox'); // findByRole('textbox');
  fireEvent.change(input, { target: { textContent: '# title' } });
  const elm = screen.queryByText('# title');
  expect((elm as any).cmView.dom.innerHTML).toEqual('# title');
});

it('CodeMirror onUpdate', async () => {
  render(
    <CodeMirror
      value="console.log('Hello world!')"
      autoFocus
      onUpdate={(viewUpdate) => {
        expect(viewUpdate.state.doc.length).toEqual(27);
      }}
    />,
  );
});

it('CodeMirror ref', async () => {
  function Demo() {
    const ref = useRef<ReactCodeMirrorRef>(null);
    useEffect(() => {
      expect(Object.keys(ref.current!)).toEqual(['editor', 'state', 'view']);
    }, [ref]);

    return <CodeMirror ref={ref} value="console.log('Hello world!')" />;
  }
  render(<Demo />);
});

it('CodeMirror theme', async () => {
  const component = renderer.create(<CodeMirror theme="dark" />);
  let tree = component.toJSON();
  if (tree && !Array.isArray(tree)) {
    expect(tree.type).toEqual('div');
    expect(tree.props.className).toEqual('cm-theme-dark');
  }
});

it('CodeMirror className', async () => {
  const component = renderer.create(<CodeMirror className="test" />);
  let tree = component.toJSON();
  if (tree && !Array.isArray(tree)) {
    expect(tree.type).toEqual('div');
    expect(tree.props.className).toEqual('cm-theme-light test');
  }
});

it('CodeMirror placeholder', async () => {
  render(<CodeMirror placeholder="Hello World" className="test" />);
  const elm = screen.queryByText('Hello World');
  expect(elm!.style['pointerEvents']).toEqual('none');
  expect(elm!.className).toEqual('cm-placeholder');
});

it('CodeMirror editable', async () => {
  render(<CodeMirror editable={false} className="test" />);
  const text = screen.getByRole('textbox');
  expect(text.className).toEqual('cm-content');
  expect(text.tagName).toEqual('DIV');
});

it("CodeMirror doesn't echo changes", async () => {
  const handleChange = jest.fn();
  const { rerender } = render(<CodeMirror value="value a" onChange={handleChange} />);
  rerender(<CodeMirror value="value b" onChange={handleChange} />);
  expect(handleChange).not.toHaveBeenCalled();
});
