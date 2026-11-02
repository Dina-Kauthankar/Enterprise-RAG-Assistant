'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getAuthHeaders } from '@/lib/cookies';
import { getFullApiUrl } from '@/lib/config';
import CitationsPanel, { Citation } from './CitationsPanel';
import { Send, ThumbsUp, ThumbsDown, Bot, User as UserIcon, AlertCircle, LogIn, Sparkles } from 'lucide-react';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatInterface({
  currentSessionId,
  onSessionCreated,
  onOpenAuth,
}: {
  currentSessionId: string | null;
  onSessionCreated: (id: string) => void;
  onOpenAuth: () => void;
}) {
  const { user, backendConnected, checkBackend } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    const loadSessionMessages = async () => {
      if (!currentSessionId || !user) {
        setMessages([]);
        setCitations([]);
        return;
      }
      try {
        const url = getFullApiUrl(`/api/v1/chat/sessions/${currentSessionId}`);
        const res = await fetch(url, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (e) {
        console.error('Failed to load session messages:', e);
      }
    };

    loadSessionMessages();
  }, [currentSessionId, user]);

  const handleSend = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (directText || query).trim();
    if (!textToSend || loading) return;

    if (!user) {
      window.location.href = '/login';
      return;
    }

    setQuery('');
    setCitations([]);

    const userMessage: Message = { role: 'user', content: textToSend };
    const tempAssistantMessage: Message = { role: 'assistant', content: '' };

    setMessages((prev) => [...prev, userMessage, tempAssistantMessage]);
    setLoading(true);

    try {
      const chatUrl = getFullApiUrl('/api/v1/chat');
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          session_id: currentSessionId,
          question: textToSend,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server returned error (${response.status})`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let messageId: string | undefined = undefined;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const textChunk = decoder.decode(value, { stream: true });
        const lines = textChunk.split('\n\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.replace('data: ', '').trim();
          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'init') {
              if (!currentSessionId && parsed.session_id) {
                onSessionCreated(parsed.session_id);
              }
              messageId = parsed.message_id;
            } else if (parsed.type === 'token') {
              assistantText += parsed.token;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  id: messageId,
                  role: 'assistant',
                  content: assistantText,
                };
                return next;
              });
            } else if (parsed.type === 'citations') {
              setCitations(parsed.citations || []);
            }
          } catch {
            // Partial chunk
          }
        }
      }
    } catch (err: any) {
      checkBackend();
      const msg = err.message || 'Failed to communicate with RAG assistant.';
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: `⚠️ ${msg}. Ensure FastAPI backend is running at http://localhost:8000.`,
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (messageId: string, rating: number) => {
    try {
      const fbUrl = getFullApiUrl('/api/v1/feedback');
      const res = await fetch(fbUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ message_id: messageId, rating }),
      });
      if (res.ok) {
        setFeedbackSent((prev) => ({ ...prev, [messageId]: rating }));
      }
    } catch (e) {
      console.error('Feedback error:', e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Offline Alert Banner */}
      {!backendConnected && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Backend is not detected on port 8000. Please start your backend via: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-semibold">uvicorn app.main:app --port 8000</code>
            </span>
          </div>
          <button
            type="button"
            onClick={checkBackend}
            className="text-xs font-bold text-amber-900 underline hover:text-black cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto my-12 text-center">
            <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
              <Bot className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1.5">
              Enterprise Knowledge Assistant
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
              Ask natural-language questions about internal policies. Every answer is grounded in indexed documents with page-level citations.
            </p>

            {/* Prompt Suggestion Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto text-xs">
              <button
                type="button"
                onClick={() => {
                  setQuery('What is the standard annual paid time off policy?');
                  if (!user) window.location.href = '/login';
                }}
                className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-xs transition text-left group cursor-pointer"
              >
                <div className="flex items-center space-x-1.5 mb-1 text-slate-800 font-semibold group-hover:text-indigo-600 transition">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Vacation & Leave</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-snug">
                  What is the standard annual PTO policy?
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuery('What are the remote work equipment stipend guidelines?');
                  if (!user) window.location.href = '/login';
                }}
                className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-xs transition text-left group cursor-pointer"
              >
                <div className="flex items-center space-x-1.5 mb-1 text-slate-800 font-semibold group-hover:text-indigo-600 transition">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Equipment Stipend</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-snug">
                  What are the home office guidelines?
                </p>
              </button>
            </div>

            {!user && (
              <div className="mt-8 p-4 bg-indigo-50 border border-indigo-200 rounded-xl max-w-md mx-auto text-xs flex items-center justify-between text-indigo-900 shadow-xs">
                <span className="font-medium">Sign in or register to query enterprise policies</span>
                <Link
                  href="/login"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In / Register</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={idx}
                className={`flex items-start space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-2xl px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content || 'Searching documents & formulating answer...'}</p>
                  {!isUser && m.id && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Citation-Grounded Response</span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleFeedback(m.id!, 1)}
                          className={`hover:text-emerald-600 transition p-1 cursor-pointer ${
                            feedbackSent[m.id!] === 1 ? 'text-emerald-600 font-bold' : ''
                          }`}
                          title="Thumbs Up"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback(m.id!, -1)}
                          className={`hover:text-rose-600 transition p-1 cursor-pointer ${
                            feedbackSent[m.id!] === -1 ? 'text-rose-600 font-bold' : ''
                          }`}
                          title="Thumbs Down"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {isUser && (
                  <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs flex-shrink-0 mt-1">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Verified Citations Drawer */}
      <CitationsPanel citations={citations} />

      {/* Input Form */}
      <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center space-x-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={user ? "Ask a question about internal company documents..." : "Sign in / register to query internal company documents..."}
            disabled={loading}
            className="flex-1 bg-slate-100 border border-slate-300 focus:border-indigo-600 focus:bg-white text-slate-800 px-4 py-2.5 rounded-xl text-xs focus:outline-hidden transition shadow-inner"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center justify-center cursor-pointer active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
