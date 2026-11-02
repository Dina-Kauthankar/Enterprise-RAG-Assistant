'use client';

import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';

export interface Citation {
  chunk_id: string;
  document_id: string;
  title: string;
  page_no: number;
  snippet: string;
}

export default function CitationsPanel({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="px-6 py-3 bg-indigo-50/80 border-t border-indigo-100 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-950">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <span>Grounded Source Citations</span>
        </div>
        <span className="text-[10px] text-indigo-700 bg-indigo-100 font-semibold px-2 py-0.5 rounded-full">
          Rerank Top-{citations.length}
        </span>
      </div>

      <div className="flex space-x-3 overflow-x-auto pb-1 scrollbar-thin">
        {citations.map((c, i) => (
          <div
            key={c.chunk_id || i}
            className="bg-white border border-indigo-200 rounded-xl p-3 shadow-xs min-w-[260px] max-w-[300px] flex-shrink-0"
          >
            <div className="flex items-center justify-between text-xs font-bold text-indigo-900 mb-1">
              <span className="truncate pr-1" title={c.title}>
                {c.title}
              </span>
              <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded font-mono">
                p. {c.page_no}
              </span>
            </div>
            <p className="text-slate-600 line-clamp-3 text-[11px] leading-relaxed italic">
              &ldquo;{c.snippet}&rdquo;
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

