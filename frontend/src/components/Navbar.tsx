'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { BookOpen, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';

export default function Navbar({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { user, logout, backendConnected } = useAuth();

  return (
    <header className="bg-indigo-700 text-white shadow-md px-6 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="bg-white/10 p-2 rounded-xl">
          <BookOpen className="w-5 h-5 text-indigo-200" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight">Enterprise Knowledge Assistant</h1>
          <p className="text-xs text-indigo-200">Citation-Grounded RAG with Role-Based Access Control</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Backend Connectivity Status Indicator */}
        <div
          className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
            backendConnected
              ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
              : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
          }`}
          title={backendConnected ? 'Connected to FastAPI backend' : 'Backend server offline (run: uvicorn app.main:app --port 8000)'}
        >
          <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span>{backendConnected ? 'Backend Live' : 'Backend Offline'}</span>
        </div>

        {user ? (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 bg-indigo-900/60 px-3 py-1 rounded-full border border-indigo-400/30 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{user.email}</span>
              <span className="ml-1 uppercase text-[10px] bg-indigo-500/50 px-1.5 py-0.5 rounded font-bold">
                {user.role}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex items-center space-x-1 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Link
              href="/login"
              className="flex items-center space-x-1.5 bg-white text-indigo-700 hover:bg-indigo-50 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In / Register</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
