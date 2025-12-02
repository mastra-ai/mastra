"use client";
import { useState, useEffect } from 'react';

function usePageInView() {
    const [isInView, setIsInView] = useState(true);
    useEffect(() => {
        const handleVisibilityChange = () => setIsInView(!document.hidden);
        if (document.hidden) {
            handleVisibilityChange();
        }
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);
    return isInView;
}

export { usePageInView };
