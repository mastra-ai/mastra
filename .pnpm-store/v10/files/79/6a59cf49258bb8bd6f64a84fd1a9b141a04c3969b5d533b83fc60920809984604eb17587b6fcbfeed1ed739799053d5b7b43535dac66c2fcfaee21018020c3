"use client";

// src/utils/smooth/useSmooth.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useMessage } from "../../context/index.js";
import { useCallbackRef } from "@radix-ui/react-use-callback-ref";
import { useSmoothStatusStore } from "./SmoothContext.js";
import { writableStore } from "../../context/ReadonlyStore.js";
var TextStreamAnimator = class {
  constructor(currentText, setText) {
    this.currentText = currentText;
    this.setText = setText;
  }
  animationFrameId = null;
  lastUpdateTime = Date.now();
  targetText = "";
  start() {
    if (this.animationFrameId !== null) return;
    this.lastUpdateTime = Date.now();
    this.animate();
  }
  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  animate = () => {
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastUpdateTime;
    let timeToConsume = deltaTime;
    const remainingChars = this.targetText.length - this.currentText.length;
    const baseTimePerChar = Math.min(5, 250 / remainingChars);
    let charsToAdd = 0;
    while (timeToConsume >= baseTimePerChar && charsToAdd < remainingChars) {
      charsToAdd++;
      timeToConsume -= baseTimePerChar;
    }
    if (charsToAdd !== remainingChars) {
      this.animationFrameId = requestAnimationFrame(this.animate);
    } else {
      this.animationFrameId = null;
    }
    if (charsToAdd === 0) return;
    this.currentText = this.targetText.slice(
      0,
      this.currentText.length + charsToAdd
    );
    this.lastUpdateTime = currentTime - timeToConsume;
    this.setText(this.currentText);
  };
};
var SMOOTH_STATUS = Object.freeze({
  type: "running"
});
var useSmooth = (state, smooth = false) => {
  const { text } = state;
  const id = useMessage({
    optional: true,
    selector: (m) => m.id
  });
  const idRef = useRef(id);
  const [displayedText, setDisplayedText] = useState(text);
  const smoothStatusStore = useSmoothStatusStore({ optional: true });
  const setText = useCallbackRef((text2) => {
    setDisplayedText(text2);
    if (smoothStatusStore) {
      const target = displayedText !== text2 || state.status.type === "running" ? SMOOTH_STATUS : state.status;
      writableStore(smoothStatusStore).setState(target, true);
    }
  });
  useEffect(() => {
    if (smoothStatusStore) {
      const target = displayedText !== text || state.status.type === "running" ? SMOOTH_STATUS : state.status;
      writableStore(smoothStatusStore).setState(target, true);
    }
  }, [smoothStatusStore, text, displayedText, state.status]);
  const [animatorRef] = useState(
    new TextStreamAnimator(text, setText)
  );
  useEffect(() => {
    if (!smooth) {
      animatorRef.stop();
      return;
    }
    if (idRef.current !== id || !text.startsWith(animatorRef.targetText)) {
      idRef.current = id;
      setText(text);
      animatorRef.currentText = text;
      animatorRef.targetText = text;
      animatorRef.stop();
      return;
    }
    animatorRef.targetText = text;
    animatorRef.start();
  }, [setText, animatorRef, id, smooth, text]);
  useEffect(() => {
    return () => {
      animatorRef.stop();
    };
  }, [animatorRef]);
  return useMemo(
    () => smooth ? {
      type: "text",
      text: displayedText,
      status: text === displayedText ? state.status : SMOOTH_STATUS
    } : state,
    [smooth, displayedText, state, text]
  );
};
export {
  useSmooth
};
//# sourceMappingURL=useSmooth.js.map