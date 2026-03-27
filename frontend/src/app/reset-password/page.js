'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/services/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [formData, setFormData] = useState({ email: emailParam, code: '', newPassword: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (emailParam) {
      setFormData((prev) => ({ ...prev, email: emailParam }));
    }
  }, [emailParam]);

  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post('/v1/auth/verify-code', formData);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Código incorrecto o expirado.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 relative overflow-hidden">
        <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl shadow-emerald-900/5 text-center z-10 border border-slate-100">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">¡Contraseña Actualizada!</h2>
          <p className="text-slate-500 mb-6">Tu cuenta de Routvi está segura. Ya puedes volver a entrar con tu nueva clave.</p>
          <div className="inline-flex items-center text-sm font-semibold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full h-10">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Redirigiendo al login...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-slate-50 min-h-screen relative overflow-hidden">
      {/* Decoraciones sutiles de fondo */}
      <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-emerald-100 rounded-full blur-[100px] z-0 pointer-events-none"></div>

      <div className="w-full flex items-center justify-center p-8 sm:p-12 z-10">
        <div className="w-full max-w-lg space-y-8 bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-white">
          <div>
            <h2 className="text-3xl font-extrabold text-center text-slate-900 tracking-tight">
              Asegurar tu cuenta
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500">
              Revisa la bandeja de entrada de <strong>{formData.email}</strong> e ingresa el código PIN.
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              
              <input type="hidden" name="email" value={formData.email} />

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 text-center">Código PIN (6 dígitos)</label>
                <input
                  name="code"
                  type="text"
                  required
                  maxLength={6}
                  className="mt-1 text-center tracking-[0.75em] text-3xl font-mono block w-full bg-slate-50 border border-slate-200 text-emerald-700 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-inner"
                  placeholder="------"
                  value={formData.code}
                  onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.replace(/[^0-9]/g, '') }))}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nueva Contraseña</label>
                <input
                  name="newPassword"
                  type="password"
                  required
                  className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all sm:text-sm"
                  placeholder="Combina letras mayúsculas, números y símbolos"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex items-start">
                <div className="ml-3 text-sm text-red-700 font-medium">{error}</div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || formData.code.length < 6 || !formData.newPassword}
                className="w-full flex justify-center items-center rounded-xl bg-emerald-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 hover:ring-offset-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Validando código...' : 'Restablecer mi contraseña'}
              </button>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Cargando...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
