/**
 * EEXA Global Error Boundary
 * Catches ALL React errors — never shows white screen.
 * Displays diagnostic UI with error details in development.
 */
import { Component, type ReactNode } from 'react';

interface Props  { children: ReactNode; fallback?: ReactNode; }
interface State  { hasError: boolean; error: Error | null; errorInfo: string; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: '' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught:', error, info);
    this.setState({ errorInfo: info.componentStack ?? '' });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isDev = import.meta.env.DEV;

      return (
        <div style={{
          background:   '#0f172a',
          color:        '#f1f5f9',
          padding:      '2rem',
          minHeight:    '100vh',
          fontFamily:   'system-ui, -apple-system, sans-serif',
          direction:    'rtl',
        }}>
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div style={{
              background: '#1e293b',
              border:     '1px solid #ef4444',
              borderRadius: '12px',
              padding:    '2rem',
              marginBottom: '1rem',
            }}>
              <h1 style={{ color: '#ef4444', margin: '0 0 1rem', fontSize: '1.5rem' }}>
                ⚠️ حدث خطأ غير متوقع
              </h1>
              <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                عذراً، توقف التطبيق بسبب خطأ داخلي. يمكنك محاولة إعادة تحميل الصفحة.
              </p>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: isDev ? '1.5rem' : 0 }}>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    background: '#3b82f6', color: '#fff',
                    border: 'none', borderRadius: '8px',
                    padding: '0.6rem 1.4rem', cursor: 'pointer',
                    fontSize: '0.95rem', fontFamily: 'inherit',
                  }}
                >
                  🔄 إعادة تحميل الصفحة
                </button>
                <button
                  onClick={this.handleReset}
                  style={{
                    background: '#475569', color: '#fff',
                    border: 'none', borderRadius: '8px',
                    padding: '0.6rem 1.4rem', cursor: 'pointer',
                    fontSize: '0.95rem', fontFamily: 'inherit',
                  }}
                >
                  ↩️ محاولة الاسترداد
                </button>
                <button
                  onClick={() => { window.location.href = '/'; }}
                  style={{
                    background: '#1e293b', color: '#94a3b8',
                    border: '1px solid #334155', borderRadius: '8px',
                    padding: '0.6rem 1.4rem', cursor: 'pointer',
                    fontSize: '0.95rem', fontFamily: 'inherit',
                  }}
                >
                  🏠 الصفحة الرئيسية
                </button>
              </div>

              {isDev && this.state.error && (
                <details style={{ marginTop: '1.5rem' }}>
                  <summary style={{ cursor: 'pointer', color: '#fbbf24', marginBottom: '0.75rem' }}>
                    🐛 تفاصيل الخطأ (وضع التطوير)
                  </summary>
                  <pre style={{
                    background: '#0f172a', padding: '1rem',
                    borderRadius: '8px', overflow: 'auto',
                    color: '#f87171', fontSize: '12px',
                    direction: 'ltr', textAlign: 'left',
                    lineHeight: 1.5, margin: 0,
                  }}>
                    <strong>{this.state.error.name}: {this.state.error.message}</strong>
                    {'\n\n'}
                    {this.state.error.stack}
                    {this.state.errorInfo && '\n\nComponent Stack:' + this.state.errorInfo}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Lightweight section-level boundary for non-critical panels.
 * Shows a subtle error card instead of crashing the whole page.
 */
export function SectionErrorBoundary({ children, name = 'هذا القسم' }: {
  children: ReactNode; name?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div style={{
          background: '#1e293b', border: '1px solid #334155',
          borderRadius: '8px', padding: '1rem',
          color: '#94a3b8', textAlign: 'center', direction: 'rtl',
        }}>
          ⚠️ تعذّر تحميل {name}
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
