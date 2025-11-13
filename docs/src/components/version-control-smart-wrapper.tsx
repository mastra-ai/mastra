import React, { Component, type ReactNode } from "react";
import VersionControlSmart from "./version-control-smart";

type Props = {
  size?: "sm" | "default";
  className?: string;
  docsPluginId?: string;
};

type State = {
  hasError: boolean;
};

class VersionControlErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("VersionControlSmart error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Silently fail - don't render anything if there's an error
      return null;
    }

    return <VersionControlSmart {...this.props} />;
  }
}

export default function VersionControlSmartWrapper(props: Props): ReactNode {
  return <VersionControlErrorBoundary {...props} />;
}
