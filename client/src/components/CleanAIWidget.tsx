import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface ApiError extends Error {
  status?: number;
  code?: string;
}

const SESSION_KEY = 'dai_session_id';
const MAX_MESSAGE_CHARS = 2000;

function newSessionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// The session ID is the only credential for a conversation, so it is random
// and kept in localStorage so the chat survives navigating the host site.
function loadSessionId(): string {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored && stored.length >= 8 && stored.length <= 100) return stored;
  } catch {}
  const id = newSessionId();
  try { localStorage.setItem(SESSION_KEY, id); } catch {}
  return id;
}

async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let data: { error?: string; code?: string } = {};
    try { data = await res.json(); } catch {}
    const err: ApiError = new Error(data.error || 'Something went wrong. Please try again.');
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return res.json();
}

// Render plain text with http(s) links made clickable
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const match = part.match(/^(.*?)([.,;:!?)\]]*)$/)!;
        return (
          <React.Fragment key={i}>
            <a href={match[1]} target="_blank" rel="noopener noreferrer" className="underline break-all">
              {match[1]}
            </a>
            {match[2]}
          </React.Fragment>
        );
      })}
    </>
  );
}

interface CleanAIWidgetProps {
  // When rendered inside the widget.js iframe, the chat window fills the
  // iframe; widget.js sizes the iframe itself.
  embedded?: boolean;
}

export default function CleanAIWidget({ embedded = false }: CleanAIWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(loadSessionId);
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [widgetConfig, setWidgetConfig] = useState(() => {
    try {
      const cached = localStorage.getItem('dai_widget_config');
      if (cached) return JSON.parse(cached);
    } catch {}
    return { companyName: 'AI Assistant', widgetGreeting: "Hi! I'm your AI assistant. How can I help you today?", primaryColor: '#2194f3' };
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  const sessionIdRef = useRef(sessionId);
  const connectingFor = useRef<string | null>(null);
  const { toast } = useToast();

  isOpenRef.current = isOpen;
  sessionIdRef.current = sessionId;

  useEffect(() => {
    fetch('/api/widget/config')
      .then(r => r.json())
      .then(data => {
        setWidgetConfig(data);
        try { localStorage.setItem('dai_widget_config', JSON.stringify(data)); } catch {}
      })
      .catch(() => {});
  }, []);

  // Tell widget.js to resize the iframe
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ source: 'documentorai', type: isOpen ? 'open' : 'close' }, '*');
    }
    if (isOpen) setUnread(0);
  }, [isOpen]);

  // Get or create the conversation, and load its history once
  useEffect(() => {
    if (!isOpen || conversationId || connectingFor.current === sessionId) return;
    const sid = sessionId;
    connectingFor.current = sid;
    (async () => {
      try {
        const conv = await api<{ id: number }>('POST', '/api/conversations', { sessionId: sid });
        const history = await api<Message[]>('GET', `/api/conversations/${conv.id}/messages?sessionId=${encodeURIComponent(sid)}`);
        if (sessionIdRef.current !== sid) return;
        setConversationId(conv.id);
        setMessages(history);
      } catch (err) {
        toast({
          title: "Couldn't connect to the assistant",
          description: (err as Error).message,
          variant: 'destructive',
        });
      } finally {
        if (connectingFor.current === sid) connectingFor.current = null;
      }
    })();
  }, [isOpen, conversationId, sessionId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending]);

  function startNewConversation() {
    const id = newSessionId();
    try { localStorage.setItem(SESSION_KEY, id); } catch {}
    setSessionId(id);
    setConversationId(null);
    setMessages([]);
  }

  const handleSendMessage = async () => {
    const text = message.trim();
    if (!text || !conversationId || isSending) return;

    // Show the user's message right away; replaced by the saved copy on success
    const tempId = -Date.now();
    setMessages(m => [...m, { id: tempId, role: 'user', content: text, createdAt: new Date().toISOString() }]);
    setMessage('');
    setIsSending(true);

    try {
      const data = await api<{ userMessage: Message; aiMessage: Message }>(
        'POST',
        `/api/conversations/${conversationId}/messages`,
        { content: text, sessionId },
      );
      setMessages(m => [...m.filter(x => x.id !== tempId), data.userMessage, data.aiMessage]);
      if (!isOpenRef.current) setUnread(u => u + 1);
    } catch (err) {
      const apiErr = err as ApiError;
      setMessages(m => m.filter(x => x.id !== tempId));
      setMessage(text);
      if (apiErr.code === 'conversation_limit') {
        startNewConversation();
        toast({ title: 'Started a new conversation', description: 'Please send your message again.' });
      } else {
        toast({ title: 'Failed to send message', description: apiErr.message, variant: 'destructive' });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleWidget = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div
      className="fixed bottom-0 right-0 z-50 font-sans pointer-events-auto"
      style={{ '--primary': widgetConfig.primaryColor } as React.CSSProperties}
    >
      {/* Collapsed State - Circular Button */}
      {!isOpen && (
        <div className="relative m-4">
          <Button
            onClick={toggleWidget}
            aria-label={`Open chat with ${widgetConfig.companyName}`}
            className="w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-primary hover:bg-primary/90"
          >
            <MessageCircle className="w-7 h-7" />
          </Button>
          {unread > 0 && (
            <div
              className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium"
              aria-label={`${unread} unread`}
            >
              {unread}
            </div>
          )}
        </div>
      )}

      {/* Expanded State - Chat Window */}
      {isOpen && (
        <Card
          role="dialog"
          aria-label={`Chat with ${widgetConfig.companyName}`}
          className={`${embedded
            ? 'w-[calc(100vw-2rem)] h-[calc(100vh-2rem)]'
            : 'w-[360px] h-[520px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]'
          } bg-white border border-gray-300 shadow-2xl flex flex-col m-4 rounded-lg overflow-hidden animate-in slide-in-from-bottom-4 duration-300`}
        >

          {/* Header */}
          <div className="bg-primary text-white p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium">{widgetConfig.companyName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleWidget}
              aria-label="Close chat"
              className="w-6 h-6 hover:bg-white/20 rounded-full p-0 text-white hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3" aria-live="polite">
            {/* Welcome Message */}
            {messages.length === 0 && (
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary" aria-hidden="true" />
                </div>
                <div className="bg-gray-100 rounded-lg p-2 max-w-[80%]">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {widgetConfig.widgetGreeting}
                  </p>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-start space-x-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-primary" aria-hidden="true" />
                  </div>
                )}

                <div className={`rounded-lg p-2 max-w-[75%] ${
                  msg.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    <Linkified text={msg.content} />
                  </p>
                </div>

                {msg.role === 'user' && (
                  <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 text-gray-600" aria-hidden="true" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isSending && (
              <div className="flex items-start space-x-2" aria-label="Assistant is typing">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary" aria-hidden="true" />
                </div>
                <div className="bg-gray-100 rounded-lg p-2">
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-3">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder={conversationId ? 'Type your message...' : 'Connecting...'}
                aria-label="Message"
                value={message}
                maxLength={MAX_MESSAGE_CHARS}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                aria-label="Send message"
                disabled={!message.trim() || !conversationId || isSending}
                className="px-3 py-2 h-auto"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Watermark */}
          <div className="py-0.5 text-center border-t border-gray-100">
            <a
              href="https://documentorai.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-gray-400 hover:text-gray-500 no-underline"
            >
              Powered by DocumentorAI
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}
