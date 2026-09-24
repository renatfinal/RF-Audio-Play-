'use client';

import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted || isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#9d4edd] to-[#7b2cbf] text-white text-xs font-semibold shadow-lg hover:opacity-90 transition-all border border-[#9d4edd]/40 cursor-pointer"
        title="Instalar Aplicativo"
      >
        <Download className="w-3.5 h-3.5 animate-bounce" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#9d4edd]/50 bg-[#160f33] text-[#e0aaff] text-xs font-semibold shadow hover:border-[#9d4edd] transition-all cursor-pointer"
          title="Instalar no iOS"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Instalar App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#160f33] border border-[#3c1671] p-6 shadow-2xl text-white relative">
              <button 
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-[#7b749b] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-white mb-2">Instalar no iPhone / iPad</h3>
              <p className="text-xs text-[#b8b2dc] leading-relaxed space-y-2">
                Para instalar este aplicativo na tela inicial do seu dispositivo iOS:
                <br /><br />
                1. Toque no botão de <strong>Compartilhamento</strong> <span className="inline-block px-1.5 py-0.5 bg-[#241b4e] rounded">⎋</span> na barra inferior do Safari.
                <br /><br />
                2. Role o menu para baixo e toque em &ldquo;Adicionar à Tela de Início&rdquo;.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#9d4edd] to-[#7b2cbf] py-2 text-xs font-semibold text-white shadow hover:opacity-90 transition"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
