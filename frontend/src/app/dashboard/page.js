'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/v1/auth/me');
        setProfile(response.data.data);
      } catch (err) {
        console.error('Error in Dashboard:', err);
        setProfile({
          error: true,
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 font-medium animate-pulse">Autenticando credenciales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar Minimalista */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-black tracking-tight text-emerald-600">
                Routvi
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm font-medium text-slate-500">
                {profile?.email}
              </span>
              <button 
                onClick={handleLogout}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-2 px-4 rounded-xl transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Tu Panel de Control</h1>
          <p className="text-slate-500 mt-2">Bienvenido de nuevo. Aquí tienes un resumen de tu actividad.</p>
        </div>

        {/* Tarjetas Informativas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Rol Activo</h3>
            </div>
            <p className="text-2xl font-black text-slate-800 capitalize">{profile?.rol || 'No definido'}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              </div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Verificación</h3>
            </div>
            <p className="text-lg font-bold text-emerald-600 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
              Correo Confirmado
            </p>
          </div>

          <div className="bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-600/20 p-6 flex flex-col justify-center relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <h3 className="text-sm font-bold text-emerald-100 uppercase tracking-wider mb-2">ID AWS Cognito</h3>
            <p className="text-lg font-mono font-medium opacity-90 truncate" title={profile?.id}>{profile?.id || '...'}</p>
          </div>
        </div>

        {/* Sección de Datos Crudos */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800">Carga Útil de Perfil</h2>
            <p className="text-sm text-slate-500">Datos recibidos desde el endpoint protegido de Routvi/Cognito</p>
          </div>
          <div className="p-6">
            <pre className="text-sm font-mono text-slate-700 bg-slate-800  !text-slate-300 p-5 rounded-xl overflow-x-auto shadow-inner">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </div>
        </div>

      </main>
    </div>
  );
}
