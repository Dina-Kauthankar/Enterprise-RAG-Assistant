'use client';

import React, { useState } from 'react';
import { getAuthHeaders } from '@/lib/cookies';
import { getFullApiUrl } from '@/lib/config';
import { X, Upload, AlertCircle } from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export default function DocumentUploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
}: DocumentUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [employeeAccess, setEmployeeAccess] = useState(true);
  const [adminAccess, setAdminAccess] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const roles: string[] = [];
    if (employeeAccess) roles.push('employee');
    if (adminAccess) roles.push('admin');

    if (roles.length === 0) {
      setError('Please select at least one role for access control.');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    roles.forEach((r) => formData.append('roles', r));

    try {
      const url = getFullApiUrl('/api/v1/documents');
      const res = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to upload document');
      }

      onUploadSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error uploading document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-800">Upload Policy Document</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Select PDF File
            </label>
            <input
              type="file"
              accept=".pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Role Access Control (RBAC)
            </label>
            <div className="space-y-2 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={employeeAccess}
                  onChange={(e) => setEmployeeAccess(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 font-medium">Employee Access</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adminAccess}
                  onChange={(e) => setAdminAccess(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 font-medium">Admin Access</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              SQL-level filtering guarantees employees will never retrieve chunks from admin-only files.
            </p>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl transition text-xs shadow-xs disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
          >
            {uploading ? (
              <span>Uploading & Ingesting PDF...</span>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload & Ingest PDF</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
