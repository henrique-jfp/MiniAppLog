import { useState, useEffect } from 'react'
import { LayoutDashboard, Package, Map, Users, Settings, RefreshCw, Navigation } from 'lucide-react'
import MapView from './MapView'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [tgUser, setTgUser] = useState(null)
  const [roleInfo, setRoleInfo] = useState({ role: 'loading' })
  const [routeInfo, setRouteInfo] = useState(null)
  const [adminStats, setAdminStats] = useState(null)
  const [loading, setLoading] = useState(false)

  // 1. Inicialização e Auth
  useEffect(() => {
    let userId = null;

    // Tenta pegar do Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand() // Força tela cheia
      
      if (tg.initDataUnsafe?.user) {
        setTgUser(tg.initDataUnsafe.user)
        userId = tg.initDataUnsafe.user.id
      }
      
      // Ajusta tema
      if (tg.colorScheme === 'dark') {
        document.documentElement.classList.add('dark')
      }
    }

    // Fallback para Dev (Query Param)
    if (!userId) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('user_id')) {
        userId = parseInt(params.get('user_id'));
        setTgUser({ id: userId, first_name: 'Dev User' });
      }
    }

    if (userId) {
      fetchUserData(userId);
    } else {
      setRoleInfo({ role: 'guest' });
    }
  }, [])

  // 2. Fetch de Dados
  const fetchUserData = async (id) => {
    setLoading(true)
    try {
      // Auth
      const rAuth = await fetch(`/api/auth/me?user_id=${id}`)
      const authData = await rAuth.json()
      setRoleInfo(authData)

      if (authData.role === 'admin') {
        // Fetch Stats
        const rStats = await fetch('/api/admin/stats')
        setAdminStats(await rStats.json())
      } else if (authData.role === 'deliverer') {
        // Fetch Route
        const rRoute = await fetch(`/api/deliverer/route?user_id=${id}`)
        setRouteInfo(await rRoute.json())
      }

    } catch (e) {
      console.error("Erro fetching data", e)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    if (tgUser?.id) fetchUserData(tgUser.id)
  }

  // --- RENDERS ---

  const renderAdminDashboard = () => (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
        <h2 className="text-lg font-semibold opacity-90">Painel do Chefe 🚀</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm opacity-70">Pacotes Hoje</p>
            <p className="text-2xl font-bold">{adminStats?.packages_total || 0}</p>
          </div>
          <div>
            <p className="text-sm opacity-70">Entregues</p>
            <p className="text-2xl font-bold">{adminStats?.delivered || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Status da Sessão
        </h3>
        {adminStats?.active_session ? (
            <div className="text-green-600 font-medium">✅ Sessão Ativa: {adminStats.session_name}</div>
        ) : (
            <div className="text-gray-500">💤 Nenhuma sessão aberta</div>
        )}
      </div>
    </div>
  )

  const renderDelivererDashboard = () => (
    <div className="space-y-4">
      {/* Card Status */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl p-6 text-white shadow-lg">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-lg font-semibold opacity-90">Olá, {roleInfo.name} 👋</h2>
                <p className="text-sm opacity-80 mt-1">{roleInfo.is_partner ? 'Sócio Parceiro' : 'Colaborador'}</p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
                <Package className="w-6 h-6" />
            </div>
        </div>
      </div>

      {/* Rota Ativa */}
      {routeInfo?.has_route ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-lg">Sua Rota de Hoje</h3>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{routeInfo.summary.total_packages} pacotes</span>
            </div>
            
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2 p-4 text-center text-sm border-b border-gray-100 dark:border-gray-700">
                <div>
                   <span className="block text-gray-500 text-xs">Paradas</span>
                   <span className="font-semibold">{routeInfo.summary.total_stops}</span>
                </div>
                 <div>
                   <span className="block text-gray-500 text-xs">Distância</span>
                   <span className="font-semibold">{routeInfo.summary.distance_km} km</span>
                </div>
                 <div>
                   <span className="block text-gray-500 text-xs">Tempo</span>
                   <span className="font-semibold">{routeInfo.summary.estimated_time_min} min</span>
                </div>
            </div>

            {/* Mapa (Exibido apenas na aba Rotas ou aqui mesmo) */}
            <div className="p-4">
                <button 
                  onClick={() => setActiveTab('routes')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                    <Navigation className="w-5 h-5" /> Iniciar Rota no Mapa
                </button>
            </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-sm">
            <div className="bg-gray-100 dark:bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Map className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-gray-900 dark:text-white font-semibold">Sem rota por enquanto</h3>
            <p className="text-gray-500 text-sm mt-2">Aguarde o administrador distribuir as entregas.</p>
            <button onClick={handleRefresh} className="mt-4 text-blue-600 text-sm font-medium">Verificar novamente</button>
        </div>
      )}
    </div>
  )

  const renderContent = () => {
    if (activeTab === 'dashboard') {
        if (roleInfo.role === 'admin') return renderAdminDashboard()
        if (roleInfo.role === 'deliverer') return renderDelivererDashboard()
        return <div className="p-4 text-center text-gray-500">Carregando perfil...</div>
    }

    if (activeTab === 'routes') {
        if (roleInfo.role === 'deliverer' && routeInfo?.has_route) {
            return (
                <div className="h-[calc(100vh-140px)] w-full">
                    <MapView stops={routeInfo.stops} />
                </div>
            )
        }
        return <div className="p-10 text-center text-gray-500">Nenhuma rota para exibir no mapa.</div>
    }

    return <div className="p-10 text-center text-gray-500">Em breve...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm p-4 flex justify-between items-center sticky top-0 z-20">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Bot Entregador
        </h1>
        <button onClick={handleRefresh} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <RefreshCw size={20} className={loading ? 'animate-spin text-blue-600' : 'text-gray-500'} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 overflow-auto pb-24">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe z-30">
        <div className="flex justify-around items-center h-16">
          <TabButton 
            icon={<LayoutDashboard size={24} />} 
            label="Início" 
            isActive={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <TabButton 
            icon={<Map size={24} />} 
            label="Mapa" 
            isActive={activeTab === 'routes'} 
            onClick={() => setActiveTab('routes')} 
          />
           <TabButton 
            icon={<Users size={24} />} 
            label="Equipe" 
            isActive={activeTab === 'team'} 
            onClick={() => setActiveTab('team')} 
          />
        </div>
      </nav>
    </div>
  )
}

function TabButton({ icon, label, isActive, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
        isActive 
          ? 'text-blue-600 dark:text-blue-400' 
          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
      }`}
    >
        <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
            {icon}
        </div>
      <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
  )
}

export default App
