import { useEffect } from 'react';
import './focus.css';

let mountedControls = 0;
let keyboardNavigation = false;

function setKeyboardNavigation(next: boolean) {
  if (keyboardNavigation === next) return;
  keyboardNavigation = next;
  document.documentElement.setAttribute('data-mastra-keyboard-navigation', String(next));
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Tab') setKeyboardNavigation(true);
}

function handlePointerDown() {
  setKeyboardNavigation(false);
}

function trackKeyboardNavigation() {
  if (mountedControls === 0) {
    document.documentElement.setAttribute('data-mastra-keyboard-navigation', 'false');
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
  }
  mountedControls += 1;
  return () => {
    mountedControls -= 1;
    if (mountedControls === 0) {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.documentElement.removeAttribute('data-mastra-keyboard-navigation');
      keyboardNavigation = false;
    }
  };
}

export function useKeyboardNavigation() {
  useEffect(trackKeyboardNavigation, []);
}
