import { useState, useEffect } from 'react'
import { LayoutDashboard, Package, Map, Users, Settings } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [tgUser, setTgUser] = useState(null)

  useEffect(() => {
    // Inicializa WebApp do Telegram
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      setTgUser(tg.initDataUnsafe?.user)
      
      // Ajusta as cores baseado no tema do telegram
      if (tg.colorScheme === 'dark') {
        document.documentElement.classList.add('dark')
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow p-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Bot Entregador 🚀
        </h1>
        {tgUser && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{tgUser.first_name}</span>
            {tgUser.photo_url && (
              <img src={tgUser.photo_url} alt="Profile" className="w-8 h-8 rounded-full" />
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 overflow-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <h2 className="text-lg font-semibold opacity-90">Receita do Dia</h2>
              <p className="text-4xl font-bold mt-2">R$ 0,00</p>
              <div className="mt-4 flex gap-2 text-sm opacity-80">
                <span className="bg-white/20 px-2 py-1 rounded">0 entregas</span>
                <span className="bg-white/20 px-2 py-1 rounded">0 km</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform">
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                  <Package className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <span className="font-medium text-sm">Importar</span>
              </button>
              
              <button className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
                  <Map className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="font-medium text-sm">Rotas</span>
              </button>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
               <h3 className="font-semibold mb-3">Status da API</h3>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Sistema Operacional</span>
               </div>
            </div>
          </div>
        )}

        {/* Placeholder screens */}
        {activeTab === 'routes' && <div className="text-center mt-10 text-gray-500">Mapa em breve...</div>}
        {activeTab === 'team' && <div className="text-center mt-10 text-gray-500">Gestão de equipe em breve...</div>}
        {activeTab === 'settings' && <div className="text-center mt-10 text-gray-500">Configurações em breve...</div>}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe">
        <div className="flex justify-around items-center h-16">
          <TabButton 
            icon={<LayoutDashboard size={24} />} 
            label="Início" 
            isActive={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <TabButton 
            icon={<Map size={24} />} 
            label="Rotas" 
            isActive={activeTab === 'routes'} 
            onClick={() => setActiveTab('routes')} 
          />
           <TabButton 
            icon={<Users size={24} />} 
            label="Equipe" 
            isActive={activeTab === 'team'} 
            onClick={() => setActiveTab('team')} 
          />
          <TabButton 
            icon={<Settings size={24} />} 
            label="Ajustes" 
            isActive={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
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
      {icon}
      <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
  )
}

export default App