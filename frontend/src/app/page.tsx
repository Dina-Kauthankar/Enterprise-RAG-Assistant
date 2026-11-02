'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import ChatInterface from '@/components/ChatInterface';
import DocumentUploadModal from '@/components/DocumentUploadModal';
import AuthModal from '@/components/AuthModal';

export default function Home() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  const handleNewChat = () => {
    setCurrentSessionId(null);
  };

  const handleUploadSuccess = () => {
    setSidebarRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-sans">
      <Navbar onOpenAuth={() => setIsAuthOpen(true)} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          key={sidebarRefreshKey}
          currentSessionId={currentSessionId}
          onSelectSession={(id) => setCurrentSessionId(id)}
          onNewChat={handleNewChat}
          onOpenUpload={() => setIsUploadOpen(true)}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          <ChatInterface
            currentSessionId={currentSessionId}
            onSessionCreated={(id) => setCurrentSessionId(id)}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        </main>
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}

