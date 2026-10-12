
  import { createRoot } from "react-dom/client";
  import React, { Component, ReactNode } from "react";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: any}> {
    constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
    componentDidCatch(error: any, errorInfo: any) { console.error("Crash:", error, errorInfo); }
    render() {
      if (this.state.hasError) {
        return (
          <div style={{ padding: 20, color: "red", background: "black", minHeight: "100vh", fontFamily: "monospace" }}>
            <h2>App Crashed!</h2>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{this.state.error?.toString()}</pre>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 10 }}>{this.state.error?.stack}</pre>
          </div>
        );
      }
      return this.props.children;
    }
  }

  createRoot(document.getElementById("root")!).render(<ErrorBoundary><App /></ErrorBoundary>);
  