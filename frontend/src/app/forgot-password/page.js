'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post('/v1/auth/reset-password', { email });
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al solicitar recuperación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <div className="w-full flex items-center justify-center p-8 sm:p-12 relative overflow-hidden">
        {/* Decoraciones sutiles de fondo */}
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-emerald-100 rounded-full blur-[80px] z-0"></div>
        <div className="absolute bottom-[0%] left-[-5%] w-[300px] h-[300px] bg-teal-50 rounded-full blur-[80px] z-0"></div>

        <div className="w-full max-w-md space-y-8 bg-white/80 backdrop-blur-xl p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-white z-10">
          <div>
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
            </div>
            <h2 className="text-3xl font-extrabold text-center text-slate-900 tracking-tight">
              Recuperar Acceso
            </h2>
            <p className="mt-3 text-center text-sm text-slate-500 max-w-sm mx-auto">
              Ingresa el correo electrónico asociado a tu cuenta y te enviaremos un PIN de 6 dígitos.
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Correo Electrónico</label>
              <input
                name="email"
                type="email"
                required
                className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all sm:text-sm"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex items-start">
                <div className="ml-3 text-sm text-red-700 font-medium">{error}</div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 hover:ring-offset-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : 'Enviar PIN a mi correo'}
              </button>
            </div>
            
            <div className="text-center text-sm mt-6">
               <a href="/login" className="font-semibold text-slate-500 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                 Volver al inicio de sesión
               </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
