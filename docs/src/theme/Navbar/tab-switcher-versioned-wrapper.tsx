import React, { Component, type ReactNode } from "react";
import { TabSwitcherVersioned } from "./tab-switcher-versioned";

type Props = {
  className?: string;
};

type State = {
  hasError: boolean;
};

class TabSwitcherVersionedErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("TabSwitcherVersioned error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Silently fail - don't render anything if there's an error
      return null;
    }

    return <TabSwitcherVersioned {...this.props} />;
  }
}

export default function TabSwitcherVersionedWrapper(props: Props): ReactNode {
  return <TabSwitcherVersionedErrorBoundary {...props} />;
}
