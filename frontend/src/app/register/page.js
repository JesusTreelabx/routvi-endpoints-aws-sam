'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '', rol: 'cliente' });
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
      await api.post('/v1/auth/register', formData);
      router.push('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Ocurrió un error al registrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex bg-slate-50 min-h-screen">
      {/* Sección Izquierda - Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md space-y-10">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">Comienza Ahora</h2>
            <p className="mt-3 text-base text-slate-500">¿Ya tienes una cuenta? <a href="/login" className="font-semibold text-emerald-600 hover:text-emerald-500 transition-colors">Inicia sesión</a></p>
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
                <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña Fuerte</label>
                <input
                  name="password"
                  type="password"
                  required
                  className="block w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all sm:text-sm"
                  placeholder="Min 8 char, mayúscula, número, símbolo"
                  value={formData.password}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">¿Qué tipo de cuenta deseas?</label>
                <div className="relative">
                  <select
                    name="rol"
                    value={formData.rol}
                    onChange={handleInputChange}
                    className="block w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all sm:text-sm"
                  >
                    <option value="cliente">🍽️ Comensal (Cliente)</option>
                    <option value="negocio">🏪 Dueño de Restaurante</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-emerald-600">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </div>
                </div>
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
                  Creando cuenta...
                </span>
              ) : 'Crear Cuenta Segura'}
            </button>
          </form>
        </div>
      </div>

      {/* Sección Derecha - Diseño Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-emerald-900 overflow-hidden items-center justify-center">
        {/* Patrón de puntos o gradientes */}
        <div className="absolute top-[20%] right-[-20%] w-[600px] h-[600px] bg-emerald-600/40 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[80px]"></div>
        
        <div className="relative z-10 text-center px-16">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl">
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-4">
              Impulsa tu <br/>Crecimiento
            </h1>
            <p className="text-emerald-50 text-base font-medium leading-relaxed">
              Únete a la nueva era digital. Un solo sistema que conecta tu deliciosa oferta con miles de clientes locales hambrientos de descubrirte.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
