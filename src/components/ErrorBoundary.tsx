import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'حدث خطأ غير متوقع في التطبيق',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center bg-[#0e131b] p-4 text-right">
          <div className="w-full max-w-md rounded-xl border border-[#ef4444]/40 bg-[#161e2b] p-6 text-center shadow-2xl">
            <AlertTriangle className="mx-auto h-10 w-10 text-[#ef4444]" />
            <h2 className="mt-3 text-lg font-extrabold text-white">
              حدث خطأ غير متوقع
            </h2>
            <p className="mt-2 break-words text-xs leading-relaxed text-[#9aa8bd]">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2bb673] px-4 py-2 text-xs font-extrabold text-[#072115] transition hover:bg-[#32c87f]"
            >
              <RotateCcw className="h-4 w-4" />
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
