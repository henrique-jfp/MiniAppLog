import { useState, useEffect } from 'react'
import { LayoutDashboard, Package, Map as MapIcon, Users, RefreshCw, Navigation, DollarSign, Sparkles, Zap, TrendingUp, Award, Moon, Sun, Archive } from 'lucide-react'
import MapView from './MapView'
import FinancialView from './FinancialView'
import TeamView from './TeamView'
import RouteAnalysisView from './RouteAnalysisView'
import SeparationMode from './SeparationMode'
import HistoryView from './pages/HistoryView'
import ProgressBar from './components/ProgressBar'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [tgUser, setTgUser] = useState(null)
  const [roleInfo, setRoleInfo] = useState({ role: 'loading' })
  const [routeInfo, setRouteInfo] = useState(null)
  const [adminStats, setAdminStats] = useState(null)
  const [financialData, setFinancialData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // 1. Inicialização e Auth
  useEffect(() => {
    let userId = null;

    // Detectar dark mode automático
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
    if (prefersDark) {
      document.documentElement.classList.add('dark')
    }

    // Listener para mudanças de dark mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleDarkModeChange = (e) => {
      setDarkMode(e.matches);
      if (e.matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    };
    mediaQuery.addEventListener('change', handleDarkModeChange);

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

    return () => mediaQuery.removeEventListener('change', handleDarkModeChange);
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
    if (tgUser?.id) {
      setLoadingProgress(0);
      setLoading(true);
      
      // Simular progresso
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 80) {
            clearInterval(interval);
            return prev;
          }
          return prev + Math.random() * 40;
        });
      }, 300);

      fetchUserData(tgUser.id).finally(() => {
        setLoadingProgress(100);
        setTimeout(() => setLoadingProgress(0), 500);
      });
    }
  }

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  // --- RENDERS ---

  const renderAdminDashboard = () => (
    <div className="space-y-5 animate-fade-in">
      {/* Hero Stats Card */}
      <div className="relative overflow-hidden gradient-primary rounded-3xl p-6 text-white shadow-glass">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium text-white/80 mb-1">Painel Administrativo</h2>
              <p className="text-2xl font-bold">Visão Geral 🚀</p>
            </div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 text-white/70 text-xs mb-2">
                <Package className="w-3.5 h-3.5" />
                <span>Pacotes Hoje</span>
              </div>
              <p className="text-3xl font-black">{adminStats?.packages_total || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 text-white/70 text-xs mb-2">
                <Zap className="w-3.5 h-3.5" />
                <span>Entregues</span>
              </div>
              <p className="text-3xl font-black text-green-300">{adminStats?.delivered || 0}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-3">
        <ActionCard 
          icon={<DollarSign className="w-5 h-5" />}
          label="Financeiro"
          sublabel="Ver receitas"
          color="green"
          onClick={() => setActiveTab('financial')}
        />
        <ActionCard 
          icon={<Users className="w-5 h-5" />}
          label="Equipe"
          sublabel="Gerenciar"
          color="blue"
          onClick={() => setActiveTab('team')}
        />
      </div>

      {/* Feature Card - AI Analysis */}
      <button 
        onClick={() => setActiveTab('analysis')}
        className="w-full group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl" />
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-white/20 to-purple-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        
        <div className="relative p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-lg">Análise Inteligente</p>
              <p className="text-purple-100 text-xs font-medium">Upload & Otimização IA</p>
            </div>
          </div>
          <div className="text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Session Status Card */}
      <div className="card-premium p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
            <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Status da Sessão</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Monitoramento em tempo real</p>
          </div>
        </div>
        
        {adminStats?.active_session ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-soft" />
            <div className="flex-1">
              <p className="font-semibold text-green-700 dark:text-green-400 text-sm">Sessão Ativa</p>
              <p className="text-xs text-green-600 dark:text-green-500">{adminStats.session_name}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Nenhuma sessão ativa</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderDelivererDashboard = () => (
    <div className="space-y-5 animate-fade-in">
      {/* Hero Greeting Card */}
      <div className="relative overflow-hidden gradient-success rounded-3xl p-6 text-white shadow-glass">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-sm font-medium text-white/80 mb-1">Bem-vindo de volta 👋</p>
              <h2 className="text-2xl font-black">{roleInfo.name?.split(' ')[0]}</h2>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              {roleInfo.is_partner && (
                <span className="badge bg-yellow-400/30 text-yellow-100 border-yellow-400/50 text-[10px] px-2 py-0.5">
                  <Award className="w-3 h-3" /> SÓCIO
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard 
          icon={<DollarSign className="w-5 h-5" />}
          label="Saldo Semana"
          value={`R$ ${financialData?.balance ? financialData.balance.toFixed(0) : '...'}`}
          color="green"
          onClick={() => setActiveTab('financial')}
        />
        <StatCard 
          icon={<MapIcon className="w-5 h-5" />}
          label="Rota Atual"
          value={routeInfo?.has_route ? 'Ativa' : 'Sem rota'}
          color="blue"
          isDisabled={!routeInfo?.has_route}
          onClick={() => setActiveTab('routes')}
        />
      </div>

      {/* Active Route Details */}
      {routeInfo?.has_route && (
        <div className="card-premium overflow-hidden animate-slide-up">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-5 py-3 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Rota em Andamento</h3>
              <span className="badge badge-info">
                <Package className="w-3 h-3" />
                {routeInfo.summary.total_packages} volumes
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700/50">
            <RouteMetric 
              icon={<Navigation className="w-4 h-4" />}
              value={routeInfo.summary.total_stops}
              label="Paradas"
            />
            <RouteMetric 
              icon={<TrendingUp className="w-4 h-4" />}
              value={`${routeInfo.summary.distance_km} km`}
              label="Distância"
            />
            <RouteMetric 
              icon={<Zap className="w-4 h-4" />}
              value={`${routeInfo.summary.estimated_time_min}m`}
              label="Tempo"
            />
          </div>

          <div className="p-4">
            <button 
              onClick={() => setActiveTab('routes')}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Navigation className="w-5 h-5" />
              <span>Abrir Navegação</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!routeInfo?.has_route && (
        <div className="card-premium p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <MapIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white mb-2">Nenhuma rota ativa</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Aguardando designação de entregas</p>
        </div>
      )}
    </div>
  )

  const renderContent = () => {
    // Tela de Loading Inicial - SPLASH SCREEN PREMIUM
    if (roleInfo.role === 'loading') {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
              {/* Logo Grande */}
              <div className="mb-8 animate-fade-in">
                <div className="w-24 h-24 rounded-2xl shadow-2xl shadow-primary-500/30 overflow-hidden border-4 border-white dark:border-gray-800 mx-auto">
                  <img src="/logoMiniApp.jpg" alt="Bot Entregador" className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Título */}
              <div className="text-center mb-12 animate-slide-up">
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">Bot Entregador</h1>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sistema de Rotas Inteligente</p>
              </div>

              {/* Loading Animation */}
              <div className="mb-12 animate-fade-in">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-4 border-primary-200 dark:border-primary-900 rounded-full" />
                  <div className="absolute inset-0 border-4 border-transparent border-t-primary-600 border-r-primary-500 rounded-full animate-spin" />
                </div>
              </div>

              {/* Status Text */}
              <div className="text-center mb-8 space-y-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Preparando seu ambiente</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Carregando dados e sincronizando rotas...</p>
              </div>

              {/* Progress Bar */}
              <div className="w-48 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-primary-500 via-purple-500 to-primary-500 animate-shimmer" style={{
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 2s infinite'
                }} />
              </div>

              {/* Footer */}
              <div className="absolute bottom-8 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-600">
                  Versão 3.0 • Sistema Hybrid
                </p>
              </div>
            </div>
        )
    }

    if (activeTab === 'dashboard') {
        if (roleInfo.role === 'admin') return renderAdminDashboard()
        if (roleInfo.role === 'deliverer') return renderDelivererDashboard()
        return (
          <div className="card-premium p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Acesso Restrito</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Você não tem permissão para acessar</p>
          </div>
        )
    }

    if (activeTab === 'analysis') {
        return (
             <div className="h-full overflow-y-auto">
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
                <div className="h-[calc(100vh-140px)] w-full rounded-2xl overflow-hidden shadow-glass border border-gray-200 dark:border-gray-700 relative">
                    <MapView stops={routeInfo.stops} />
                    {/* Floating Info Overlay */}
                    <div className="absolute top-3 left-3 right-3 glass-strong p-3 rounded-xl shadow-lg z-[1000] flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-soft" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">Modo Navegação</span>
                        </div>
                        <span className="badge badge-info text-[10px]">{routeInfo.stops.length} pontos</span>
                    </div>
                </div>
            )
        }
        return (
          <div className="card-premium p-10 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <MapIcon className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Nenhuma rota disponível</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Não há rotas para exibir no mapa</p>
          </div>
        )
    }

    if (activeTab === 'financial') {
      return <FinancialView data={financialData} adminStats={adminStats} />
    }
    
    if (activeTab === 'team') {
        return <TeamView />;
    }

    if (activeTab === 'history') {
        return <HistoryView />;
    }

    return (
      <div className="card-premium p-10 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Zap className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="font-bold text-gray-900 dark:text-white mb-2">Em Desenvolvimento</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Esta funcionalidade estará disponível em breve 🚧</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      {/* Header Premium */}
      <header className="glass-strong sticky top-0 z-20 border-b border-gray-200/50 dark:border-gray-700/50 pt-safe">
        <div className="max-w-lg mx-auto px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl shadow-lg shadow-primary-500/30 overflow-hidden flex-shrink-0 border-2 border-white dark:border-gray-700">
                <img src="/logoMiniApp.jpg" alt="Bot Entregador" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse-soft" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900 dark:text-white leading-none">Bot Entregador</h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Sistema de Rotas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleDarkMode}
              className="relative w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-all active:scale-90 group"
            >
              {darkMode ? (
                <Sun size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-primary-600" />
              ) : (
                <Moon size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-primary-600" />
              )}
            </button>
            <button 
              onClick={handleRefresh} 
              className="relative w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-all active:scale-90 group"
            >
              <RefreshCw 
                size={18} 
                className={`${loading ? 'animate-spin text-primary-600' : 'text-gray-500 dark:text-gray-400 group-hover:text-primary-600'} transition-colors`} 
              />
            </button>
          </div>
        </div>
        <ProgressBar visible={loadingProgress > 0} percentage={loadingProgress} />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto pb-24 pt-5 scrollbar-premium">
        <div className="max-w-lg mx-auto px-4">
          {renderContent()}
        </div>
      </main>

      {/* Bottom Navigation Premium */}
      <nav className="fixed bottom-0 left-0 right-0 glass-strong border-t border-gray-200/50 dark:border-gray-700/50 pb-safe z-30 shadow-glass">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-around items-center h-16 px-2">
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
              icon={<Archive size={22} />} 
              label="Histórico" 
              isActive={activeTab === 'history'} 
              onClick={() => setActiveTab('history')}
            />
          </div>
        </div>
      </nav>
    </div>
  )
}

function TabButton({ icon, label, isActive, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${
        isActive 
          ? 'text-primary-600 dark:text-primary-400' 
          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
      }`}
    >
      {/* Active Indicator */}
      {isActive && (
        <>
          <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-12 h-1 gradient-primary rounded-b-full shadow-lg shadow-primary-500/30" />
          <div className="absolute inset-0 bg-primary-50/50 dark:bg-primary-900/10 rounded-2xl mx-2" />
        </>
      )}
      
      {/* Icon Container */}
      <div className={`relative z-10 transition-all duration-300 ${isActive ? 'scale-110 -translate-y-0.5' : ''}`}>
        <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-primary-100 dark:bg-primary-900/30' : ''}`}>
          {icon}
        </div>
      </div>
      
      {/* Label */}
      <span className={`relative z-10 text-[10px] font-semibold mt-1 transition-all ${isActive ? 'font-bold' : ''}`}>
        {label}
      </span>
    </button>
  )
}

// Helper Components
function ActionCard({ icon, label, sublabel, color, onClick }) {
  const colorClasses = {
    green: 'from-green-500 to-emerald-600 shadow-green-500/30',
    blue: 'from-blue-500 to-indigo-600 shadow-blue-500/30',
    purple: 'from-purple-500 to-indigo-600 shadow-purple-500/30',
  }

  return (
    <button 
      onClick={onClick}
      className="group relative overflow-hidden"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color]} rounded-2xl shadow-lg transition-all group-hover:shadow-xl group-active:scale-95`} />
      <div className="relative p-4 flex flex-col items-center text-center text-white">
        <div className="w-10 h-10 mb-2 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
          {icon}
        </div>
        <p className="font-bold text-sm">{label}</p>
        <p className="text-[10px] text-white/70 font-medium">{sublabel}</p>
      </div>
    </button>
  )
}

function StatCard({ icon, label, value, color, isDisabled, onClick }) {
  const colorClasses = {
    green: 'from-green-500 to-emerald-600 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
    blue: 'from-blue-500 to-indigo-600 text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  }

  return (
    <button 
      onClick={onClick}
      disabled={isDisabled}
      className={`card-premium p-4 flex items-center gap-3 text-left transition-all active:scale-95 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClasses[color].split('text-')[1]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">{label}</p>
        <p className="font-bold text-lg text-gray-900 dark:text-white truncate">{value}</p>
      </div>
    </button>
  )
}

function RouteMetric({ icon, value, label }) {
  return (
    <div className="py-4 text-center">
      <div className="flex items-center justify-center gap-1 text-gray-400 dark:text-gray-500 mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-black text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}

export default App
