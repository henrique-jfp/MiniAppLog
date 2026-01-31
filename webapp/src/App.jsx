import { useState, useEffect } from 'react'
import { LayoutDashboard, Package, Map as MapIcon, Users, RefreshCw, Navigation, DollarSign, Sparkles } from 'lucide-react'
import MapView from './MapView'
import FinancialView from './FinancialView'
import TeamView from './TeamView'
import RouteAnalysisView from './RouteAnalysisView'
import SeparationMode from './SeparationMode'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [tgUser, setTgUser] = useState(null)
  const [roleInfo, setRoleInfo] = useState({ role: 'loading' })
  const [routeInfo, setRouteInfo] = useState(null)
  const [adminStats, setAdminStats] = useState(null)
  const [financialData, setFinancialData] = useState(null)
  const [loading, setLoading] = useState(false)

  // 1. Inicialização e Auth
  useEffect(() => {
    let userId = null;

    // Verifica query param ?tab= para navegação direta
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab')) {
      setActiveTab(params.get('tab'));
    }

    // Tenta pegar do Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
      
      if (tg.initDataUnsafe?.user) {
        setTgUser(tg.initDataUnsafe.user)
        userId = tg.initDataUnsafe.user.id
      }
      
      if (tg.colorScheme === 'dark') {
        document.documentElement.classList.add('dark')
      }
    }

    // Fallback para Dev
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

      // Fetch paralelo dependendo da role
      const promises = []
      
      // Financial (Todos têm acesso, mas dados diferentes)
      promises.push(
          fetch(`/api/financial/balance?user_id=${id}`)
            .then(r => r.json())
            .then(data => setFinancialData(data))
            .catch(err => console.error("Erro Finanças", err))
      )

      if (authData.role === 'admin') {
        promises.push(
            fetch('/api/admin/stats')
                .then(r => r.json())
                .then(data => setAdminStats(data))
        )
      } else if (authData.role === 'deliverer') {
        promises.push(
            fetch(`/api/deliverer/route?user_id=${id}`)
                .then(r => r.json())
                .then(data => setRouteInfo(data))
        )
      }
      
      await Promise.all(promises)

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
    <div className="space-y-4 animate-fade-in">
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
      
      <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setActiveTab('financial')} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <DollarSign className="text-green-500" />
              <span className="text-sm font-semibold">Financeiro</span>
          </button>
           <button onClick={() => setActiveTab('team')} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Users className="text-blue-500" />
              <span className="text-sm font-semibold">Equipe</span>
          </button>
      </div>

      {/* Botão de Análise de Rota (Novo Feature) */}
      <button 
         onClick={() => setActiveTab('analysis')}
         className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-xl shadow-lg shadow-purple-500/30 flex items-center justify-between group transition-all active:scale-95"
      >
          <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <Sparkles className="text-white w-6 h-6" />
              </div>
              <div className="text-left">
                  <span className="block font-bold text-lg">Analisar Rota IA</span>
                  <span className="block text-xs text-purple-100 opacity-90">Upload & Otimização Auto</span>
              </div>
          </div>
          <div className="opacity-70 group-hover:opacity-100 transform group-hover:translate-x-1 transition-all">→</div>
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Status da Sessão
        </h3>
        {adminStats?.active_session ? (
            <div className="text-green-600 font-medium bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                ✅ Sessão Ativa: {adminStats.session_name}
            </div>
        ) : (
            <div className="text-gray-500 bg-gray-50 dark:bg-gray-700/20 p-2 rounded-lg">
                💤 Nenhuma sessão aberta
            </div>
        )}
      </div>
    </div>
  )

  const renderDelivererDashboard = () => (
    <div className="space-y-4 animate-fade-in">
      {/* Card Status */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-start">
            <div>
                <h2 className="text-lg font-semibold opacity-90">Olá, {roleInfo.name?.split(' ')[0]} 👋</h2>
                <p className="text-sm opacity-80 mt-1 flex items-center gap-1">
                    {roleInfo.is_partner ? (
                        <span className="bg-yellow-400/20 text-yellow-100 px-2 py-0.5 rounded text-xs font-bold border border-yellow-400/30">SÓCIO</span>
                    ) : 'Colaborador'}
                </p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <Package className="w-6 h-6" />
            </div>
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setActiveTab('financial')}
            className="flex items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full text-green-600 dark:text-green-400">
                  <DollarSign size={20} />
              </div>
              <div className="text-left">
                  <span className="block text-xs text-gray-500">Saldo Semana</span>
                  <span className="block font-bold text-gray-900 dark:text-gray-100">
                    R$ {financialData?.balance ? financialData.balance.toFixed(0) : '...'}
                  </span>
              </div>
          </button>
           <button 
            onClick={() => setActiveTab('routes')}
            className={`flex items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow ${!routeInfo?.has_route && 'opacity-60'}`}
          >
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full text-blue-600 dark:text-blue-400">
                  <MapIcon size={20} />
              </div>
              <div className="text-left">
                  <span className="block text-xs text-gray-500">Rota Atual</span>
                  <span className="block font-bold text-gray-900 dark:text-gray-100">
                    {routeInfo?.has_route ? 'Ativa' : 'Sem rota'}
                  </span>
              </div>
          </button>
      </div>

      {/* Rota Ativa Detalhada */}
      {routeInfo?.has_route && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
             <div className="bg-gray-50 dark:bg-gray-700/30 px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-200">Resumo da Rota</h3>
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">{routeInfo.summary.total_packages} volumes</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 p-4 text-center text-sm">
                <div>
                   <span className="block text-gray-400 text-xs mb-1">Paradas</span>
                   <span className="font-semibold text-lg">{routeInfo.summary.total_stops}</span>
                </div>
                 <div>
                   <span className="block text-gray-400 text-xs mb-1">Km</span>
                   <span className="font-semibold text-lg">{routeInfo.summary.distance_km}</span>
                </div>
                 <div>
                   <span className="block text-gray-400 text-xs mb-1">Min</span>
                   <span className="font-semibold text-lg">{routeInfo.summary.estimated_time_min}</span>
                </div>
            </div>

            <div className="p-4 pt-0">
                <button 
                  onClick={() => setActiveTab('routes')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                    <Navigation className="w-5 h-5" /> Abrir Navegação
                </button>
            </div>
        </div>
      )}
    </div>
  )

  const renderContent = () => {
    // Tela de Loading Inicial
    if (roleInfo.role === 'loading') {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <RefreshCw className="animate-spin mb-2" size={32} />
                <p>Carregando Mini App...</p>
            </div>
        )
    }

    if (activeTab === 'dashboard') {
        if (roleInfo.role === 'admin') return renderAdminDashboard()
        if (roleInfo.role === 'deliverer') return renderDelivererDashboard()
        return <div className="p-4 text-center text-gray-500">Visitante não autorizado.</div>
    }

    if (activeTab === 'analysis') {
        return (
             <div className="h-full overflow-y-auto p-4">
                 <RouteAnalysisView />
             </div>
        )
    }

    if (activeTab === 'separation') {
        return (
             <div className="h-full overflow-y-auto">
                 <SeparationMode />
             </div>
        )
    }

    if (activeTab === 'routes') {
        if (roleInfo.role === 'deliverer' && routeInfo?.has_route) {
            return (
                <div className="h-[calc(100vh-140px)] w-full rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 relative">
                    <MapView stops={routeInfo.stops} />
                    {/* Floating Info Overlay */}
                    <div className="absolute top-2 left-2 right-2 bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-sm z-[1000] text-xs flex justify-between">
                        <span>🚀 Modo Navegação</span>
                        <span className="font-bold">{routeInfo.stops.length} pontos</span>
                    </div>
                </div>
            )
        }
        return <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-2">
            <MapIcon size={48} className="opacity-20"/>
            <p>Nenhuma rota para exibir no mapa.</p>
        </div>
    }

    if (activeTab === 'financial') {
        return <FinancialView data={financialData} />
    }
    
    if (activeTab === 'team') {
        return <TeamView />;
    }

    return <div className="p-10 text-center text-gray-500">Funcionalidade em desenvolvimento 🚧</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      {/* Header Minimalist */}
      <header className="bg-white dark:bg-gray-800 shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                BE
             </div>
             <h1 className="text-lg font-bold text-gray-800 dark:text-white">Bot Entregador</h1>
        </div>
        <button onClick={handleRefresh} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all">
            <RefreshCw size={18} className={loading ? 'animate-spin text-blue-600' : ''} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 overflow-auto pb-24 max-w-lg mx-auto w-full">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe z-30 shadow-[0_-5px_10px_rgba(0,0,0,0.02)]">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          <TabButton 
            icon={<LayoutDashboard size={22} />} 
            label="Início" 
            isActive={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <TabButton 
            icon={<MapIcon size={22} />} 
            label="Mapa" 
            isActive={activeTab === 'routes'} 
            onClick={() => setActiveTab('routes')} 
          />
           <TabButton 
            icon={<DollarSign size={22} />} 
            label="Ganhos"
            isActive={activeTab === 'financial'} 
            onClick={() => setActiveTab('financial')} 
          />
           <TabButton 
            icon={<Users size={22} />} 
            label="Perfil" 
            isActive={activeTab === 'profile'} 
            onClick={() => setActiveTab('dashboard')} // Por enquanto volta pro dashboard
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
      className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 relative ${
        isActive 
          ? 'text-blue-600 dark:text-blue-400 translate-y-[-2px]' 
          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
      }`}
    >
        {isActive && (
            <span className="absolute -top-3 w-10 h-1 bg-blue-600 dark:bg-blue-400 rounded-full shadow-lg shadow-blue-500/30" />
        )}
        <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
            {icon}
        </div>
      <span className={`text-[10px] font-medium mt-1 ${isActive ? 'font-bold' : ''}`}>{label}</span>
    </button>
  )
}

export default App
