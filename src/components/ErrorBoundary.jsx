import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Auto-reload on chunk load errors (stale CDN cache after new deployment).
    // Guard with sessionStorage to avoid infinite reload loops.
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Loading CSS chunk');

    if (isChunkError) {
      const reloadKey = 'chunkErrorReload';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.name === 'ChunkLoadError' ||
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk') ||
        this.state.error?.message?.includes('Loading CSS chunk');

      return (
        <div style={{ padding: 40, fontFamily: 'Inter, system-ui, sans-serif' }}>
          <h2 style={{ color: '#A40000', fontSize: 16, marginBottom: 12 }}>
            {isChunkError ? 'New version available — reloading...' : 'Something went wrong'}
          </h2>
          {!isChunkError && (
            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 300 }}>
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          )}
          <button
            onClick={() => {
              sessionStorage.removeItem('chunkErrorReload');
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            style={{ marginTop: 16, padding: '8px 16px', background: '#171717', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
          >
            Reload now
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
