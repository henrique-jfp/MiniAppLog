import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function SeparationMode() {
  const [mode, setMode] = useState('barcode'); // 'barcode' ou 'camera'
  const [barcodeInput, setBarcodeInput] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [separationSession, setSeparationSession] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  
  const inputRef = useRef(null);
  const scannerRef = useRef(null);

  // Inicia sessão de separação
  useEffect(() => {
    startSeparation();
  }, []);

  // Auto-focus no input quando em modo bipadora
  useEffect(() => {
    if (mode === 'barcode' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode, lastScanned]);

  // Configura scanner de câmera
  useEffect(() => {
    if (mode === 'camera' && !scannerRef.current) {
      const scanner = new Html5QrcodeScanner('qr-reader', {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      });

      scanner.render(
        (decodedText) => {
          handleScan(decodedText);
          scanner.pause(true);
          setTimeout(() => scanner.resume(), 2000);
        },
        (error) => {
          console.warn('Erro scanner:', error);
        }
      );

      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [mode]);

  const startSeparation = async () => {
    try {
      const res = await fetch('/api/separation/start', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail);
      
      setSeparationSession(data.session);
      setStatus(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleScan = async (barcode) => {
    if (!barcode.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/separation/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: barcode.trim() })
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail);
      
      setLastScanned(data);
      
      // Atualiza progresso
      if (data.progress) {
        setSeparationSession(prev => ({
          ...prev,
          scanned_packages: data.progress.scanned,
          progress: data.progress.percentage
        }));
      }
      
      // Limpa input
      setBarcodeInput('');
      
      // Beep sonoro de sucesso
      playBeep('success');
      
    } catch (err) {
      setError(err.message);
      playBeep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    handleScan(barcodeInput);
  };

  const completeSeparation = async () => {
    try {
      const res = await fetch('/api/separation/complete', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail);
      
      alert('Separação concluída! Agora você pode enviar as rotas aos entregadores.');
      window.location.href = '/route-analysis';
    } catch (err) {
      alert(err.message);
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
      oscillator.frequency.value = 300;
      gainNode.gain.value = 0.5;
    }
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const progressPercentage = separationSession?.progress || 0;
  const isComplete = separationSession?.scanned_packages >= separationSession?.total_packages;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🔄 Modo Separação
          </h1>
          <p className="text-indigo-200">
            Bipe cada pacote para identificar rota e entregador
          </p>
        </div>

        {/* Seletor de Modo */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-6 mb-6">
          <label className="text-white font-semibold block mb-3">Método de Bipagem:</label>
          <div className="flex gap-4">
            <button
              onClick={() => setMode('barcode')}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold transition ${
                mode === 'barcode'
                  ? 'bg-green-500 text-white'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              📟 Bipadora
            </button>
            <button
              onClick={() => setMode('camera')}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold transition ${
                mode === 'camera'
                  ? 'bg-green-500 text-white'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              📸 Câmera
            </button>
          </div>
        </div>

        {/* Progresso */}
        {separationSession && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-white font-semibold">Progresso</span>
              <span className="text-white">
                {separationSession.scanned_packages} / {separationSession.total_packages} pacotes
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-400 to-emerald-500 h-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-indigo-200 text-sm mt-2">{progressPercentage.toFixed(1)}% completo</p>
          </div>
        )}

        {/* Área de Bipagem */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-6 mb-6">
          {mode === 'barcode' ? (
            <form onSubmit={handleBarcodeSubmit}>
              <label className="text-white font-semibold block mb-3">
                Escaneie o código de barras:
              </label>
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Posicione o cursor aqui e bipe..."
                className="w-full px-4 py-3 rounded-lg bg-white/90 text-gray-900 font-mono text-lg focus:outline-none focus:ring-4 focus:ring-green-400"
                disabled={loading || isComplete}
                autoFocus
              />
              <button
                type="submit"
                className="w-full mt-4 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition"
                disabled={loading || !barcodeInput.trim() || isComplete}
              >
                {loading ? 'Processando...' : 'Confirmar Bipagem'}
              </button>
            </form>
          ) : (
            <div>
              <label className="text-white font-semibold block mb-3">
                Aponte a câmera para o código:
              </label>
              <div id="qr-reader" className="rounded-lg overflow-hidden" />
            </div>
          )}
        </div>

        {/* Último Pacote Bipado */}
        {lastScanned && (
          <div
            className="bg-white/10 backdrop-blur rounded-xl p-6 mb-6 border-4 animate-pulse"
            style={{ borderColor: lastScanned.route_color || '#fff' }}
          >
            <h3 className="text-white font-bold text-xl mb-4">
              ✅ Pacote Identificado!
            </h3>
            <div className="grid grid-cols-2 gap-4 text-white">
              <div>
                <span className="text-indigo-200 text-sm">Entregador:</span>
                <p className="font-bold text-lg">{lastScanned.deliverer_name}</p>
              </div>
              <div>
                <span className="text-indigo-200 text-sm">Cor da Rota:</span>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white"
                    style={{ backgroundColor: lastScanned.route_color }}
                  />
                  <span className="font-bold">{lastScanned.route_color}</span>
                </div>
              </div>
              <div>
                <span className="text-indigo-200 text-sm">Sequência:</span>
                <p className="font-bold text-lg">
                  #{lastScanned.sequence} de {lastScanned.total_in_route}
                </p>
              </div>
              <div>
                <span className="text-indigo-200 text-sm">Endereço:</span>
                <p className="text-sm">{lastScanned.address}</p>
              </div>
            </div>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-4 mb-6">
            <p className="text-white font-semibold">❌ {error}</p>
          </div>
        )}

        {/* Botão Finalizar */}
        {isComplete && (
          <button
            onClick={completeSeparation}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-xl rounded-xl shadow-2xl transition transform hover:scale-105"
          >
            ✅ Finalizar Separação e Enviar Rotas
          </button>
        )}
      </div>
    </div>
  );
}
