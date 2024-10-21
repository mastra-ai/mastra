import { VirtualItem } from '@tanstack/react-virtual';
import { RefObject } from 'react';

interface UseCellKeydownProps {
  tableRowRef: RefObject<HTMLTableRowElement | null>;
  virtualRow: VirtualItem;
  tableRef: RefObject<HTMLDivElement | null>;
}

const useCellKeydown = (props: UseCellKeydownProps) => {
  const { tableRowRef, tableRef } = props;

  const handleKeydownEvents = (e: React.KeyboardEvent<HTMLTableCellElement>, cell: any) => {
    e.stopPropagation();

    if (!tableRowRef) return;

    const el = tableRowRef.current;
    if (!el) return;

    //horizontal navigation
    const prevRow = el?.previousElementSibling;
    const prevRowLastCell = prevRow?.lastElementChild;

    const nextRow = el?.nextElementSibling;
    const nextRowFirstCell = nextRow?.firstElementChild;

    let currCell = el?.children.namedItem(cell.id);

    // vertical navigation
    const elArr = Array.from(el.children);
    const currCellIndex = elArr.indexOf(currCell!);
    let cellPos;

    const leftCheck = (element: HTMLElement) => {
      const leftBoundary =
        (elArr[0] as HTMLElement).offsetWidth +
        (elArr[1] as HTMLElement).offsetWidth +
        (tableRef.current ? tableRef.current.getBoundingClientRect().left : 0);
      cellPos = element.getBoundingClientRect().left;
      if (leftBoundary > cellPos) {
        tableRef.current?.scrollBy(-(leftBoundary - cellPos), 0);
      }
    };
    const rightCheck = (element: HTMLElement) => {
      const rightBoundary = tableRef.current?.getBoundingClientRect().right || 0;
      cellPos = element.getBoundingClientRect().right;
      if (cellPos > rightBoundary) {
        tableRef.current?.scrollBy(-(cellPos - rightBoundary), 0);
      }
    };

    const bottomCheck = (element: HTMLElement) => {
      const bottomBoundary = tableRef.current?.getBoundingClientRect().bottom || 0;
      cellPos = element.getBoundingClientRect().top;
      if (cellPos > bottomBoundary) {
        tableRef.current?.scrollBy(0, cellPos - bottomBoundary);
      }
    };
    const topCheck = (element: HTMLElement) => {
      const topBoundary = (tableRef.current?.getBoundingClientRect().top || 0) + element.offsetHeight;
      cellPos = element.getBoundingClientRect().bottom;
      if (cellPos < topBoundary) {
        tableRef.current?.scrollBy(0, cellPos - topBoundary);
      }
    };

    switch (e.key) {
      case 'ArrowLeft':
        (currCell as HTMLElement)?.classList.remove('before:opacity-100');
        if (currCell?.previousElementSibling == null) {
          return (currCell = prevRowLastCell as HTMLElement);
        }
        e.preventDefault();
        const prevCell = currCell?.previousElementSibling as HTMLElement;
        leftCheck(prevCell);
        rightCheck(prevCell);

        return prevCell?.focus();
      case 'ArrowRight':
        (currCell as HTMLElement)?.classList.remove('before:opacity-100');
        if (currCell?.nextElementSibling == null) {
          return (currCell = nextRowFirstCell as HTMLElement);
        }
        e.preventDefault();
        const nextCell = currCell?.nextElementSibling as HTMLElement;
        leftCheck(nextCell);
        rightCheck(nextCell);
        return nextCell?.focus();
      case 'ArrowUp':
        (currCell as HTMLElement)?.classList.remove('before:opacity-100');
        if (!prevRow) return;
        e.preventDefault();
        currCell = Array.from(prevRow?.children || [])[currCellIndex];
        topCheck(currCell as HTMLElement);
        bottomCheck(currCell as HTMLElement);
        return (currCell as HTMLElement)?.focus();
      case 'ArrowDown':
        (currCell as HTMLElement)?.classList.remove('before:opacity-100');
        if (!nextRow) return;
        e.preventDefault();
        currCell = Array.from(nextRow?.children as HTMLCollection)[currCellIndex];
        topCheck(currCell as HTMLElement);
        bottomCheck(currCell as HTMLElement);
        return (currCell as HTMLElement)?.focus();
      case 'Enter':
        if (e.shiftKey) return;
        const directChild = (currCell?.children.item(0) as HTMLElement).getAttribute('data-skip-element-on-enter')
          ? (currCell?.children.item(1) as HTMLElement)
          : (currCell?.children.item(0) as HTMLElement);

        const nestedAnchorEl = directChild.tagName === 'A';
        if (nestedAnchorEl) {
          directChild.click();
        }
        //nested button
        const nestedChildButton = directChild?.tagName === 'BUTTON' ? currCell?.children.item(0) : null;
        if (nestedChildButton) {
          //if a checkbox return
          if (nestedChildButton?.getAttribute('role') === 'checkbox') return;

          const dataState = nestedChildButton.getAttribute('data-state');
          if (dataState === 'closed') {
            (currCell as HTMLElement)?.classList.add('before:opacity-100');
          }
        }

        if (document.activeElement === directChild) {
          return (currCell as HTMLElement)?.focus();
        }
        return directChild.focus();
      case 'Escape':
        (currCell as HTMLElement)?.classList.remove('before:opacity-100');
        (currCell?.children.item(0) as HTMLElement)?.blur();
        return (currCell as HTMLElement)?.focus();
      case ' ':
        const nestedElement = currCell?.children.item(0)?.tagName === 'BUTTON' ? currCell?.children.item(0) : null;
        if (nestedElement?.getAttribute('role') === 'checkbox') {
          (nestedElement as HTMLElement).click();
        }
        break;
      default:
        (currCell as HTMLElement)?.classList.remove('before:opacity-100');
        (currCell?.children.item(0) as HTMLElement).tabIndex = -1;
        break;
    }
  };

  return { handleKeydownEvents };
};

export default useCellKeydown;
