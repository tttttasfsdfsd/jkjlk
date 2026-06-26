/**
 * ChatWidget — P2-11 extraction from Home.tsx
 * AI chat interface for financial analysis questions.
 */
import { useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User as UserIcon } from 'lucide-react';
import type { ChatMessage } from '@/types/financial';

interface ChatWidgetProps {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  isRTL: boolean;
  disabled: boolean;
  onInputChange: (val: string) => void;
  onSend: () => void;
}

export default function ChatWidget({
  messages, input, isLoading, isRTL, disabled, onInputChange, onSend,
}: ChatWidgetProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  }, [onSend]);

  if (disabled) {
    return (
      <div className="flex items-center justify-center h-32 rounded-2xl border border-white/10"
        style={{ background: 'var(--card-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {isRTL ? 'ارفع ملفاً لبدء المحادثة' : 'Upload a file to start chatting'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 overflow-hidden"
      style={{ background: 'var(--card-bg)', height: '400px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3" dir={isRTL ? 'rtl' : 'ltr'}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
              ${msg.role === 'assistant' ? 'gradient-primary' : 'bg-white/10'}`}>
              {msg.role === 'assistant'
                ? <Bot className="w-4 h-4 text-white" />
                : <UserIcon className="w-4 h-4 text-white" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm text-white
              ${msg.role === 'user' ? 'bg-indigo-600/60' : 'bg-white/5'}`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              <p className="text-xs mt-1 opacity-40">{msg.time}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white/5 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(d => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                    style={{ animationDelay: `${d * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-3 flex gap-2" dir={isRTL ? 'rtl' : 'ltr'}>
        <input
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={isRTL ? 'اسأل عن نتائجك المالية...' : 'Ask about your financials...'}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm
            text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center
            disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
          aria-label="Send"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
