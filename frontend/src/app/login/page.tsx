'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getFullApiUrl } from '@/lib/config';
import { Lock, Mail, ShieldCheck, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { login, checkBackend } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegister) {
        const regUrl = getFullApiUrl('/api/v1/auth/register');
        const regRes = await fetch(regUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, role }),
        });
        if (!regRes.ok) {
          const data = await regRes.json().catch(() => ({}));
          throw new Error(data.detail || `Registration failed (Status ${regRes.status})`);
        }
      }

      const loginUrl = getFullApiUrl('/api/v1/auth/login');
      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!loginRes.ok) {
        const data = await loginRes.json().catch(() => ({}));
        throw new Error(data.detail || 'Incorrect email or password');
      }

      const { access_token, role: userRole } = await loginRes.json();
      await login(access_token, userRole);
      router.push('/');
    } catch (err: any) {
      const isConnError = err.message.includes('Failed to fetch') || err.message.includes('NetworkError');
      if (isConnError) {
        setError('Cannot connect to FastAPI backend at http://localhost:8000. Ensure uvicorn is running!');
        checkBackend();
      } else {
        setError(err.message || 'Authentication error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          href="/"
          className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 font-semibold mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span>Back to Chat Workspace</span>
        </Link>
        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          {isRegister ? 'Create your account' : 'Sign in to Enterprise Assistant'}
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Role-Based Access Control over private company documents
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-200">
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase">
                Work Email
              </label>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@company.com"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-indigo-600"
                />
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Assign System Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="mt-1 block w-full pl-3 pr-10 py-2.5 text-xs border border-slate-300 focus:outline-hidden focus:border-indigo-600 rounded-xl bg-white"
                >
                  <option value="employee">Employee (General Document Access)</option>
                  <option value="admin">Admin (Executive Access + Document Uploads)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50 mt-4 cursor-pointer"
            >
              {loading ? 'Connecting...' : isRegister ? 'Register Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-600">
            <span>{isRegister ? 'Already registered?' : "Don't have an account yet?"}</span>
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="ml-1.5 font-semibold text-indigo-600 hover:underline cursor-pointer"
            >
              {isRegister ? 'Sign In' : 'Create an Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

