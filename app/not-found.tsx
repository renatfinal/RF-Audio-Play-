import Link from 'next/link';
import { Home, Music } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0f0b21] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-[#160f33]/80 backdrop-blur-xl border border-[#3c1671]/50 rounded-3xl p-8 shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-[#9d4edd] to-[#7b2cbf] flex items-center justify-center shadow-lg shadow-[#9d4edd]/30">
          <Music className="w-8 h-8 text-white animate-pulse" />
        </div>
        
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Página não encontrada</h1>
        <p className="text-sm text-[#b8b2dc] mb-8 leading-relaxed">
          A faixa ou página que você está procurando não existe ou foi movida.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[#9d4edd] to-[#7b2cbf] text-white text-sm font-semibold shadow-lg shadow-[#7b2cbf]/30 hover:opacity-90 transition-all"
        >
          <Home className="w-4 h-4" />
          <span>Voltar ao Player</span>
        </Link>
      </div>
    </div>
  );
}
