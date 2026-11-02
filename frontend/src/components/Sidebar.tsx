'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getAuthHeaders } from '@/lib/cookies';
import { getFullApiUrl } from '@/lib/config';
import { Plus, MessageSquare, FileText, Upload, RefreshCw, Trash2 } from 'lucide-react';

export interface DocumentItem {
  id: string;
  title: string;
  status: string;
  page_count: number;
  allowed_roles: string[];
}

export interface SessionItem {
  id: string;
  title: string;
  created_at: string;
}

interface SidebarProps {
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onOpenUpload: () => void;
}

export default function Sidebar({
  currentSessionId,
  onSelectSession,
  onNewChat,
  onOpenUpload,
}: SidebarProps) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const fetchSessions = async () => {
    if (!user) return;
    try {
      const url = getFullApiUrl('/api/v1/chat/sessions');
      const res = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  };

  const fetchDocuments = async () => {
    if (!user) return;
    setLoadingDocs(true);
    try {
      const url = getFullApiUrl('/api/v1/documents');
      const res = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error('Failed to load documents:', e);
    } finally {
      setLoadingDocs(false);
    }
  };

  const deleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document and all indexed chunks?')) return;
    try {
      const url = getFullApiUrl(`/api/v1/documents/${id}`);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (e) {
      alert('Delete failed');
    }
  };

  useEffect(() => {
    if (user) {
      fetchSessions();
      fetchDocuments();
    } else {
      setSessions([]);
      setDocuments([]);
    }
  }, [user]);

  return (
    <aside className="w-80 bg-white border-r border-slate-200 flex flex-col justify-between h-full">
      <div className="p-4 flex-1 flex flex-col overflow-hidden">
        {/* New Chat Button */}
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center justify-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2.5 px-4 rounded-xl border border-indigo-200 transition mb-4 text-xs shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat Session</span>
        </button>

        {/* Sessions List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Recent Conversations
          </h2>
          <div className="space-y-1 overflow-y-auto flex-1 pr-1">
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No previous chats.</p>
            ) : (
              sessions.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition truncate flex items-center space-x-2 cursor-pointer ${
                    currentSessionId === s.id
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                  <span className="truncate">{s.title}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Admin Document Manager Section */}
        {user?.role === 'admin' && (
          <div className="pt-4 border-t border-slate-200 mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Admin Manager
              </span>
              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                ADMIN ONLY
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenUpload}
              className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white text-xs py-2 px-3 rounded-lg transition shadow-xs font-medium cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF Policy</span>
            </button>
          </div>
        )}
      </div>

      {/* Accessible Documents View */}
      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Indexed Documents
          </span>
          <button
            type="button"
            onClick={fetchDocuments}
            disabled={loadingDocs}
            className="text-slate-400 hover:text-indigo-600 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs">
          {documents.length === 0 ? (
            <p className="text-slate-400 italic">No indexed documents visible for your role.</p>
          ) : (
            documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-2xs"
              >
                <div className="overflow-hidden pr-2">
                  <div className="flex items-center space-x-1.5">
                    <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <p className="font-semibold text-slate-700 truncate" title={d.title}>
                      {d.title}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    p. {d.page_count} ·{' '}
                    <span
                      className={`font-semibold ${
                        d.status === 'ready'
                          ? 'text-emerald-600'
                          : d.status === 'failed'
                          ? 'text-red-500'
                          : 'text-amber-500'
                      }`}
                    >
                      {d.status}
                    </span>
                  </span>
                </div>
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => deleteDocument(d.id)}
                    className="text-slate-300 hover:text-red-500 transition p-1 cursor-pointer"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
