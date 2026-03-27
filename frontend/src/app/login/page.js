'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';

export default function Login() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/v1/auth/login', formData);
      const { idToken, accessToken, refreshToken } = response.data.data;
      
      localStorage.setItem('idToken', idToken);
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Correo o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex bg-slate-50 min-h-screen">
      {/* Sección Izquierda - Diseño Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-emerald-900 overflow-hidden items-center justify-center">
        {/* Círculos decorativos de fondo */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-700/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 text-center px-12">
          <h1 className="text-5xl font-extrabold text-white tracking-tight mb-6">
            Bienvenido a <span className="text-emerald-400">Routvi</span>
          </h1>
          <p className="text-lg text-emerald-100/80 font-medium max-w-md mx-auto">
            El ecosistema gastronómico inteligente. Gestiona tu negocio y llega a más comensales al instante.
          </p>
        </div>
      </div>

      {/* Sección Derecha - Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md space-y-10">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">Iniciar Sesión</h2>
            <p className="mt-3 text-base text-slate-500">¿Nuevo en la plataforma? <a href="/register" className="font-semibold text-emerald-600 hover:text-emerald-500 transition-colors">Crea tu cuenta aquí</a></p>
          </div>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Correo Electrónico</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all sm:text-sm"
                  placeholder="ejemplo@correo.com"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña</label>
                <input
                  name="password"
                  type="password"
                  required
                  className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all sm:text-sm"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Fila del Olvidé Contraseña */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded" />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600">Recuérdame</label>
              </div>
              <div className="text-sm">
                <a href="/forgot-password" className="font-semibold text-emerald-600 hover:text-emerald-500 transition-colors">¿Olvidaste tu contraseña?</a>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex items-start">
                <div className="ml-3 text-sm text-red-700 font-medium">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Iniciando...
                </span>
              ) : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
