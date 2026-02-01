import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Package, Truck, CheckCircle, Clock, ChevronRight, Barcode, Play, Flag, ArrowLeft } from 'lucide-react';
import { fetchWithAuth } from './api_client';

// Color map helper
const COLOR_NAMES = {
    '#FF4444': 'VERMELHO',
    '#44FF44': 'VERDE',
    '#4444FF': 'AZUL',
    '#FFD700': 'AMARELO',
    '#FF69B4': 'ROSA',
    '#9370DB': 'ROXO',
    '#FF8C00': 'LARANJA',
    '#00CED1': 'CIANO',
    '#32CD32': 'VERDE-LIMA',
    '#FF1493': 'ROSA-ESCURO',
};

function getColorName(hex) {
    return COLOR_NAMES[hex?.toUpperCase()] || hex || 'Cor Indefinida';
}

export default function SeparationMode() {
  const [routes, setRoutes] = useState([]);
  const [viewMode, setViewMode] = useState('scanner'); // 'scanner' | 'manage'
  
  // Separation State
  const [scanMode, setScanMode] = useState('barcode'); // 'barcode' | 'camera'
  const [barcodeInput, setBarcodeInput] = useState('');
  const [separationSession, setSeparationSession] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef(null);
  const scannerRef = useRef(null);

  // Load routes
  useEffect(() => {
    fetchRoutes();
    const interval = setInterval(fetchRoutes, 5000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Global Separation
  useEffect(() => {
    startSeparationSession();
  }, []);

  // Focus Input
  useEffect(() => {
    if (viewMode === 'scanner' && scanMode === 'barcode' && inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [viewMode, scanMode, lastScanned]);

  // Camera Setup
  useEffect(() => {
    if (viewMode === 'scanner' && scanMode === 'camera' && !scannerRef.current) {
      const scanner = new Html5QrcodeScanner('qr-reader', {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      });

      scanner.render(
        (decodedText) => {
          handleScan(decodedText);
          scanner.pause(true);
          setTimeout(() => scanner.resume(), 1500);
        },
        (error) => console.warn('Scanner error:', error)
      );

      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [viewMode, scanMode]);

  const fetchRoutes = async () => {
    try {
      const res = await fetchWithAuth('/api/session/routes_status');
      if (res.ok) {
        const data = await res.json();
        setRoutes(data);
      }
    } catch (e) {
      console.error("Error fetching routes", e);
    }
  };

  const startSeparationSession = async () => {
    try {
      const res = await fetchWithAuth('/api/separation/start', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSeparationSession(data.session);
      }
    } catch (e) {
        console.error("Error starting separation", e);
    }
  };

  const handleScan = async (barcode) => {
    if (!barcode.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetchWithAuth('/api/separation/scan', {
        method: 'POST',
        body: JSON.stringify({ barcode: barcode.trim() })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail);

      setLastScanned(data);
      if (data.progress) {
            setSeparationSession(prev => ({
                ...prev,
                scanned_packages: data.progress.scanned,
                progress: data.progress.percentage
            }));
      }
      playBeep('success');
      setBarcodeInput('');

    } catch (err) {
      setError(err.message);
      playBeep('error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStartRoute = async (routeId) => {
      if (!confirm("Confirmar saída do entregador para rota?")) return;
      try {
          const res = await fetchWithAuth(`/api/route/${routeId}/start`, { method: 'POST' });
          if (res.ok) {
              fetchRoutes();
              alert("Rota iniciada!");
          }
      } catch (e) {
          alert("Erro ao iniciar rota");
      }
  };

  const handleFinishRoute = async (routeId) => {
    if (!confirm("Confirmar que a rota foi concluída e o entregador retornou?")) return;
    try {
        const res = await fetchWithAuth(`/api/route/${routeId}/finish`, { method: 'POST' });
        if (res.ok) {
            fetchRoutes();
            alert("Rota finalizada! Dados salvos no histórico.");
        }
    } catch (e) {
        alert("Erro ao finalizar rota");
    }
  };

  const playBeep = (type) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === 'success') {
      oscillator.frequency.value = 800;
      gainNode.gain.value = 0.3;
    } else {
      oscillator.frequency.value = 150; // Low error tone
      gainNode.gain.value = 0.5;
    }
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col">
       {/* Top Bar */}
       <div className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center shadow-md z-10">
           <div>
               <h1 className="text-xl font-bold flex items-center gap-2">
                   <Barcode className="text-primary-400" /> Separação de Cargas
               </h1>
               <div className="flex items-center gap-2 text-sm text-gray-400">
                   <span>{separationSession?.scanned_packages || 0} / {separationSession?.total_packages || 0} pacotes</span>
                   <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-green-500 transition-all duration-300"
                         style={{ width: `${separationSession?.progress || 0}%` }}
                       />
                   </div>
               </div>
           </div>

           <div className="flex gap-2">
               <button 
                 onClick={() => setViewMode('scanner')}
                 className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'scanner' ? 'bg-primary-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
               >
                   Scanner
               </button>
               <button 
                 onClick={() => setViewMode('manage')}
                 className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'manage' ? 'bg-primary-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
               >
                   Gerenciar Entregas
               </button>
           </div>
       </div>

       {/* Main Content */}
       <div className="flex-1 overflow-hidden relative">
           
           {/* SCANNER VIEW */}
           {viewMode === 'scanner' && (
               <div className="h-full flex flex-col lg:flex-row">
                   
                   {/* Left Panel: Input & Modes */}
                   <div className="lg:w-1/3 bg-gray-800/50 p-6 border-r border-gray-700 flex flex-col gap-6">
                       <div className="flex bg-gray-700 rounded-lg p-1 w-full">
                           <button onClick={() => setScanMode('barcode')} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${scanMode === 'barcode' ? 'bg-gray-600 shadow-sm text-white' : 'text-gray-400'}`}>Bipadora / USB</button>
                           <button onClick={() => setScanMode('camera')} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${scanMode === 'camera' ? 'bg-gray-600 shadow-sm text-white' : 'text-gray-400'}`}>Camera</button>
                       </div>

                       <div className="flex-1 flex flex-col justify-center">
                           {scanMode === 'barcode' ? (
                               <form onSubmit={(e) => { e.preventDefault(); handleScan(barcodeInput); }}>
                                   <label className="block text-gray-400 text-sm mb-2 text-center uppercase tracking-wider font-bold">Aguardando Leitura</label>
                                   <input
                                      ref={inputRef}
                                      value={barcodeInput}
                                      onChange={e => setBarcodeInput(e.target.value)} 
                                      className="w-full h-16 text-center text-3xl font-mono tracking-widest bg-black border-2 border-primary-500 rounded-xl focus:ring-4 focus:ring-primary-500/30 outline-none text-white shadow-inner mb-4"
                                      placeholder=""
                                      autoComplete="off"
                                   />
                                   <p className="text-center text-gray-500 text-xs text-balance">
                                       Mantenha o foco nesta caixa. Use um leitor USB ou digite o código.
                                   </p>
                               </form>
                           ) : (
                               <div className="aspect-square bg-black rounded-xl overflow-hidden border-2 border-gray-600 relative">
                                   <div id="qr-reader" className="w-full h-full" />
                                   <div className="absolute inset-0 border-2 border-primary-500/50 pointer-events-none" />
                               </div>
                           )}
                       </div>

                       {error && (
                           <div className="p-4 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-center animate-shake">
                               {error}
                           </div>
                       )}
                   </div>

                   {/* Right Panel: BIG FEEDBACK */}
                   <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden transition-colors duration-500"
                        style={{ backgroundColor: lastScanned ? lastScanned.route_color : 'rgba(17, 24, 39, 1)' }}
                   >
                       {/* Background Overlay to ensure text readability */}
                       <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0" />
                       
                       <div className="relative z-10 text-center w-full max-w-3xl transform transition-all duration-300">
                           {lastScanned ? (
                               <div className="animate-in fade-in zoom-in duration-300">
                                   
                                   {/* Route Header */}
                                   <div className="mb-8 p-4 rounded-2xl bg-black/30 border border-white/10 backdrop-blur-md inline-block">
                                        <h2 className="text-2xl md:text-3xl font-medium text-white/80 uppercase tracking-widest mb-1">
                                            Rota de Entrega
                                        </h2>
                                        <div className="text-5xl md:text-7xl font-black text-white drop-shadow-lg flex items-center justify-center gap-4 py-2">
                                            <div className="w-12 h-12 rounded-full border-4 border-white shadow-lg" style={{ backgroundColor: lastScanned.route_color }} />
                                            <span>{getColorName(lastScanned.route_color).replace('ROTA ', '')}</span>
                                        </div>
                                        <p className="text-xl md:text-2xl text-white font-bold mt-2">
                                            {lastScanned.deliverer_name}
                                        </p>
                                   </div>

                                   {/* Stop Number - THE BIG ONE */}
                                   <div className="bg-white text-gray-900 rounded-3xl p-10 shadow-2xl mx-auto max-w-md transform hover:scale-105 transition-transform duration-300 border-8 border-white/20">
                                       <span className="block text-xl md:text-2xl font-bold text-gray-500 uppercase tracking-widest mb-2">
                                           Posição de Parada
                                       </span>
                                       <span className="block text-[120px] md:text-[180px] leading-none font-black tracking-tighter">
                                           {lastScanned.sequence}
                                       </span>
                                       <div className="mt-4 pt-4 border-t-2 border-gray-100">
                                           <div className="flex justify-between items-center text-sm font-bold text-gray-400">
                                               <span>TOTAL NA ROTA</span>
                                               <span className="text-xl text-gray-800">{lastScanned.total_in_route}</span>
                                           </div>
                                       </div>
                                   </div>

                                   {/* Address */}
                                   <div className="mt-8 text-white/90 font-medium text-lg md:text-xl truncate max-w-2xl mx-auto bg-black/40 px-6 py-3 rounded-full">
                                       📍 {lastScanned.address}
                                   </div>

                               </div>
                           ) : (
                               <div className="text-center text-gray-600 opacity-50">
                                   <Package size={120} className="mx-auto mb-6 opacity-20" />
                                   <h2 className="text-4xl font-bold mb-4">Pronto para Separar</h2>
                                   <p className="text-xl">Bipe um pacote para identificar a rota</p>
                               </div>
                           )}
                       </div>
                   </div>
               </div>
           )}

           {/* MANAGE VIEW */}
           {viewMode === 'manage' && (
              <div className="h-full overflow-y-auto p-6 bg-gray-900">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                      {routes.map(route => (
                          <div key={route.id} className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl">
                              <div className="flex justify-between items-start mb-6">
                                  <div className="flex items-center gap-4">
                                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg" style={{ backgroundColor: route.color }}>
                                          {route.assigned_to_name?.charAt(0)}
                                      </div>
                                      <div>
                                          <h3 className="text-xl font-bold text-white">{route.assigned_to_name || 'Desconhecido'}</h3>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm text-gray-400">{route.total_packages} volumes</span>
                                            <BadgeStatus status={route.status} />
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="space-y-3">
                                  <button
                                    onClick={() => handleStartRoute(route.id)}
                                    disabled={route.status !== 'pending' && route.status !== 'separating' && route.status !== 'ready'} 
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg"
                                  >
                                      <Play size={20} fill="currentColor" /> LIBERAR SAÍDA
                                  </button>
                                  
                                  <button
                                    onClick={() => handleFinishRoute(route.id)}
                                    disabled={route.status !== 'in_transit'}
                                    className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg"
                                  >
                                      <Flag size={20} fill="currentColor" /> FINALIZAR ENTREGA
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
           )}
       </div>
    </div>
  );
}

function BadgeStatus({ status, className = '' }) {
    const styles = {
        pending: 'bg-gray-700 text-gray-300',
        separating: 'bg-yellow-900/50 text-yellow-500',
        ready: 'bg-blue-900/50 text-blue-400',
        in_transit: 'bg-indigo-900/50 text-indigo-400 animate-pulse',
        completed: 'bg-green-900/50 text-green-400'
    };

    const labels = {
        pending: 'Pendente',
        separating: 'Separando',
        ready: 'Pronto',
        in_transit: 'Em Rota',
        completed: 'Finalizado'
    };

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${styles[status] || styles.pending} ${className}`}>
            {labels[status] || status}
        </span>
    );
}