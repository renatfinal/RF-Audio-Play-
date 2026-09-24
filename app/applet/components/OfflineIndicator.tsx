'use client';

import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted || isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-500/90 backdrop-blur-md px-4 py-2.5 text-xs font-medium text-white shadow-xl border border-amber-400/40">
      <div className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
      </div>
      <WifiOff className="w-4 h-4" />
      <span>Modo Offline — O app e os dados em cache continuam funcionais.</span>
    </div>
  );
};
