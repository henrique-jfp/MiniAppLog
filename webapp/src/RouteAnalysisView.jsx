import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Sparkles, MapPin, AlertCircle, Users, Send, Map, TrendingUp, Navigation } from 'lucide-react';
import { useResponsive } from './hooks/useResponsive';
import BarcodeScanner from './components/BarcodeScanner';
import { fetchWithAuth } from './api_client';

export default function RouteAnalysisView() {
  const responsive = useResponsive();
  
  // ===== ANÁLISE SIMPLES (por lista de endereços) =====
  const [viewMode, setViewMode] = useState('simple');  // 'simple' ou 'import'
  
  // Simple Analysis
  const [addressesText, setAddressesText] = useState('');
  const [simpleRouteValue, setSimpleRouteValue] = useState('');
  const [simpleAnalysis, setSimpleAnalysis] = useState(null);
  const [simpleLoading, setSimpleLoading] = useState(false);
  const [mapUrl, setMapUrl] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  
  // ===== IMPORTAÇÃO ROMANEIO (fluxo multi-import) =====
  const [file, setFile] = useState(null);
  const [importRouteValue, setImportRouteValue] = useState('');
  const [hasRomaneio, setHasRomaneio] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [importAnalysis, setImportAnalysis] = useState(null);
  const [numDeliverers, setNumDeliverers] = useState(2);
  const [routes, setRoutes] = useState([]);
  const [assignments, setAssignments] = useState({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deliverers, setDeliverers] = useState([]);
  const fileInputRef = useRef(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    // 1. Carregar Entregadores
    fetchWithAuth('/api/admin/team')
      .then(r => r.json())
      .then(data => setDeliverers(data))
      .catch(() => setDeliverers([]));

    // 2. Restaurar Estado da Sessão (Cross-Device)
    fetchWithAuth('/api/session/state')
      .then(r => r.json())
      .then(data => {
        if (data.active) {
          console.log("Restaurando sessão:", data);
          if (data.has_romaneio) {
            setViewMode('import');
            setHasRomaneio(true);
            setSessionId(data.session_id);
            if (data.route_value) setImportRouteValue(data.route_value);
            if (data.num_deliverers) setNumDeliverers(data.num_deliverers);
            
            // Restaura rotas se houver
            if (data.routes && data.routes.length > 0) {
              setRoutes(data.routes);
              setAssignments(data.assignments || {});
            }
            
            // Recarrega relatório visual
            fetchWithAuth('/api/session/report')
               .then(r => r.json())
               .then(data => setImportAnalysis(data))
               .catch(e => console.error("Erro recarregar report", e));
          }
        }
      })
      .catch(e => console.error("Erro ao checar estado", e));
  }, []);

  // ====== ABA 1: ANÁLISE SIMPLES POR ENDEREÇOS ======
  
  const handleAnalyzeAddresses = async () => {
    if (!addressesText.trim() || !simpleRouteValue) {
      setError('Preencha os endereços e o valor total');
      return;
    }

    setSimpleLoading(true);
    setError(null);
    setSimpleAnalysis(null);

    const formData = new FormData();
    formData.append('addresses_text', addressesText);
    formData.append('route_value', parseFloat(simpleRouteValue));

    try {
      const res = await fetchWithAuth('/api/routes/analyze-addresses', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Falha ao analisar');
      }

      const data = await res.json();
      setSimpleAnalysis(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSimpleLoading(false);
    }
  };

  const handleClearSimple = () => {
    setAddressesText('');
    setSimpleRouteValue('');
    setSimpleAnalysis(null);
    setMapUrl(null);
    setError(null);
  };

  const handleGenerateMap = async () => {
    if (!addressesText.trim()) {
      setError('Cole os endereços primeiro');
      return;
    }

    setMapLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('addresses_text', addressesText);

    try {
      const res = await fetchWithAuth('/api/routes/generate-map', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Falha ao gerar mapa');
      }

      const data = await res.json();
      setMapUrl(data.map_url);
    } catch (err) {
      setError(err.message);
    } finally {
      setMapLoading(false);
    }
  };

  // ====== ABA 2: IMPORTAR ROMANEIO =====

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file || !importRouteValue) {
      setError('Selecione arquivo e informe valor');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetchWithAuth('/api/romaneio/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Falha ao importar romaneio');
      }

      const data = await res.json();
      setHasRomaneio(true);
      if (data.session_id) setSessionId(data.session_id);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportAdditional = async () => {
    if (!file) {
      setError('Selecione arquivo para importar');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetchWithAuth('/api/session/romaneio/import-additional', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Falha ao importar adicional');
      }

      const data = await res.json();
      if (data.session_id) setSessionId(data.session_id);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/session/report');
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Falha ao gerar relatório');
      }
      const data = await res.json();
      setImportAnalysis(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async () => {
    setLoading(true);
    setError(null);
    setRoutes([]);

    try {
      const res = await fetchWithAuth('/api/routes/optimize', {
        method: 'POST',
        body: JSON.stringify({ num_deliverers: Number(numDeliverers) })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Falha ao otimizar rotas');
      }

      const data = await res.json();
      setRoutes(data.routes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (routeId, delivererId) => {
    try {
      const res = await fetchWithAuth('/api/routes/assign', {
        method: 'POST',
        body: JSON.stringify({ route_id: routeId, deliverer_id: Number(delivererId) })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Falha ao atribuir');
      }

      setAssignments(prev => ({ ...prev, [routeId]: delivererId }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancelSession = async () => {
    if (!confirm('🛑 Tem certeza? Isso apagará todos os romaneios e rotas atuais.')) return;
    
    setLoading(true);
    try {
      await fetchWithAuth('/api/session/cancel-import', { method: 'POST' });
      // Reset local state
      setHasRomaneio(false);
      setSessionId(null);
      setImportAnalysis(null);
      setRoutes([]);
      setAssignments({});
      setImportRouteValue('');
      setFile(null);
      setViewMode('simple'); // Volta por padrão
    } catch (err) {
      setError('Erro ao cancelar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRoutes = async () => {
    const allAssigned = routes.length > 0 && routes.every(r => assignments[r.route_id]);
    if (!allAssigned) {
      setError('Selecione um entregador para cada rota antes de iniciar.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/routes/send', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Falha ao enviar rotas');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const allAssigned = routes.length > 0 && routes.every((r) => assignments[r.route_id]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header Premium */}
      <div className={`rounded-3xl p-6 shadow-lg text-white bg-gradient-to-r from-purple-600 to-blue-600 ${responsive.isDesktop ? 'mb-8' : 'mb-5'}`}>
        <h2 className={`font-bold flex items-center gap-2 mb-2 ${responsive.isDesktop ? 'text-3xl' : 'text-2xl'}`}>
          <Sparkles size={responsive.isDesktop ? 36 : 32} /> Análise de Rota com IA
        </h2>
        <p className={`${responsive.isDesktop ? 'text-base' : 'text-purple-100'} opacity-90`}>
          Cole endereços ou importe romaneio. A IA te diz se vale a pena.
        </p>
      </div>

      {/* Abas Principais */}
      <div className={`grid gap-3 ${responsive.isDesktop ? 'grid-cols-4' : 'grid-cols-2'}`}>
        <button
          onClick={() => setViewMode('simple')}
          className={`${responsive.isDesktop ? 'py-4 px-6' : 'py-3 px-4'} rounded-xl font-bold transition-all flex items-center justify-center ${
            viewMode === 'simple'
              ? 'bg-purple-600 text-white shadow-lg scale-105'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Sparkles size={responsive.isDesktop ? 20 : 18} className="mr-2" />
          {responsive.isDesktop ? 'Análise Manual' : 'Colar'}
        </button>
        <button
          onClick={() => setViewMode('import')}
          className={`${responsive.isDesktop ? 'py-4 px-6' : 'py-3 px-4'} rounded-xl font-bold transition-all flex items-center justify-center ${
            viewMode === 'import'
              ? 'bg-blue-600 text-white shadow-lg scale-105'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <FileUp size={responsive.isDesktop ? 20 : 18} className="mr-2" />
          {responsive.isDesktop ? 'Importar Arquivo' : 'Importar'}
        </button>
      </div>

      {/* ERRO GLOBAL */}
      {error && (
        <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex gap-3 ${responsive.isDesktop ? 'text-base' : 'text-sm'}`}>
          <AlertCircle className="text-red-600 flex-shrink-0" size={responsive.isDesktop ? 24 : 20} />
          <div className="flex-1">
            <p className="font-bold text-red-800 dark:text-red-300">Erro detectado</p>
            <p className="text-red-700 dark:text-red-400 mt-1">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* ===== ABA 1: COLAR ENDEREÇOS ===== */}
      {viewMode === 'simple' && (
        <div className="space-y-4">
          {/* Input Area */}
          <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${responsive.isDesktop ? 'p-6' : 'p-4'}`}>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex justify-between">
              <span>📝 Cola os Endereços (um por linha)</span>
              <span className="text-xs font-normal text-gray-400">{addressesText.trim() ? addressesText.trim().split('\n').length : 0} linhas</span>
            </label>
            <textarea
              value={addressesText}
              onChange={(e) => setAddressesText(e.target.value)}
              placeholder={`Rua Principado de Mônaco, 37, Apt 501
Rua Mena Barreto, 161, Loja BMRIO
Rua General Polidoro, 322, 301
...`}
              className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none resize-none ${responsive.isDesktop ? 'h-48 p-4' : 'h-40 p-3'}`}
            />
          </div>

          {/* Value Input e Ações */}
          <div className={`grid gap-4 ${responsive.isDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${responsive.isDesktop ? 'p-6' : 'p-4'}`}>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                💰 Valor Total da Rota (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">R$</span>
                <input
                  type="number"
                  value={simpleRouteValue}
                  onChange={(e) => setSimpleRouteValue(e.target.value)}
                  placeholder="150.00"
                  className="w-full pl-10 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold text-lg outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleAnalyzeAddresses}
                disabled={simpleLoading || !addressesText.trim() || !simpleRouteValue}
                className="col-span-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex flex-col items-center justify-center gap-1 p-2"
              >
                {simpleLoading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Sparkles size={24} />
                    <span>Analisar</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleClearSimple}
                className="col-span-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200 font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-1 p-2"
              >
                <FileUp size={24} className="rotate-180" /> 
                <span>Limpar</span>
              </button>
            </div>
          </div>
          {/* Resultado */}
          {simpleAnalysis && (
            <div className="space-y-4">
              {/* Header com destaque */}
              <div className={`bg-gradient-to-r rounded-xl p-6 text-white ${
                simpleAnalysis.header?.['📊 SCORE'] >= 7
                  ? 'from-green-500 to-emerald-600'
                  : simpleAnalysis.header?.['📊 SCORE'] >= 5
                  ? 'from-yellow-500 to-orange-600'
                  : 'from-red-500 to-pink-600'
              }`}>
                <div className={`grid gap-4 ${responsive.isDesktop ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  <div>
                    <p className="text-sm opacity-80">Valor</p>
                    <p className="text-2xl font-bold">{simpleAnalysis.header?.['💰 VALOR']}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-80">Tipo</p>
                    <p className={`font-bold ${String(simpleAnalysis.header?.['⭐ TIPO'] || '').length > 10 ? 'text-xl' : 'text-2xl'}`}>{simpleAnalysis.header?.['⭐ TIPO']}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-80">Score</p>
                    <p className="text-3xl font-bold">{simpleAnalysis.header?.['📊 SCORE']}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-80">Ganho/hora</p>
                    <p className="text-2xl font-bold">{simpleAnalysis.financial?.hourly}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold">{simpleAnalysis.header?.['✅ RECOMENDAÇÃO']}</p>
              </div>

              {/* Top Drops - Estilo Melhorado */}
              {simpleAnalysis.top_drops && simpleAnalysis.top_drops.length > 0 && (
                <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-5 border-2 border-orange-200 dark:border-orange-700">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-lg">
                    <TrendingUp size={22} className="text-orange-600" />
                    🔥 Top Drops (Ruas com Maior Concentração)
                  </h4>
                  <div className="space-y-3">
                    {simpleAnalysis.top_drops.map((drop, i) => (
                      <div 
                        key={i} 
                        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all transform hover:scale-102 ${
                          i === 0 
                            ? 'bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 border-yellow-300 dark:border-yellow-600 shadow-md' 
                            : i === 1
                            ? 'bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 border-blue-300 dark:border-blue-600'
                            : 'bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-700 dark:to-slate-700 border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-4xl">{drop.emoji}</span>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white text-lg">{drop.street}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold">{drop.count} endereços</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{drop.percentage}</p>
                          <p className="text-xs text-gray-500">concentração</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Perfil da Rota */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-bold text-gray-900 dark:text-white mb-3">📊 Perfil da Rota</h4>
                <div className={`grid gap-3 ${responsive.isDesktop ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Tipo</p>
                    <p className="font-bold text-gray-900 dark:text-white">{simpleAnalysis.profile?.type}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Comercial</p>
                    <p className="font-bold text-gray-900 dark:text-white">{simpleAnalysis.profile?.commercial_pct}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Pacotes</p>
                    <p className="font-bold text-gray-900 dark:text-white">{simpleAnalysis.profile?.total_packages}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Paradas</p>
                    <p className="font-bold text-gray-900 dark:text-white">{simpleAnalysis.profile?.unique_stops}</p>
                  </div>
                </div>
              </div>

              {/* Análise Qualitativa */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-bold text-gray-900 dark:text-white mb-3">✅ Prós</h4>
                <ul className="space-y-2">
                  {simpleAnalysis.analysis?.pros?.map((pro, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-green-500 font-bold mt-0.5">✓</span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-bold text-gray-900 dark:text-white mb-3">⚠️ Contras</h4>
                <ul className="space-y-2">
                  {simpleAnalysis.analysis?.cons?.map((con, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-red-500 font-bold mt-0.5">✗</span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Comentário IA */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-2">🤖 Comentário da IA</h4>
                <p className="text-sm text-blue-800 dark:text-blue-400 whitespace-pre-wrap leading-relaxed">
                  {simpleAnalysis.ai_comment}
                </p>
              </div>

              {/* MAPA - Lazy Load */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 text-white font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Map size={20} />
                    🗺️ Minimapa da Rota
                  </div>
                  {mapLoading && <span className="text-sm">⏳ Gerando...</span>}
                </div>
                
                {mapUrl ? (
                  <iframe
                    src={mapUrl}
                    className="w-full h-96 border-0"
                    title="Mapa da Rota"
                    allowFullScreen=""
                  />
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      ⚠️ Geocodificação lenta (3-5 seg por endereço)
                    </p>
                    <button
                      onClick={handleGenerateMap}
                      disabled={mapLoading}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                      {mapLoading ? '⏳ Gerando Mapa...' : '🗺️ Gerar Mapa'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== ABA 2: IMPORTAR ROMANEIO ===== */}
      {viewMode === 'import' && (
        <div className="space-y-4">
          {/* Upload File */}
          <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${responsive.isDesktop ? 'p-6' : 'p-4'}`}>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls"
                className="hidden"
              />
              <FileUp size={48} className="mx-auto text-gray-400 mb-4" />
              {file ? (
                <div>
                  <p className="font-bold text-green-600 text-lg">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-gray-700 dark:text-gray-300 text-lg">Clique ou arraste arquivo Excel</p>
                  <p className="text-sm text-gray-500">Suporta .xlsx ou .xls (Shopee)</p>
                </div>
              )}
            </div>
          </div>

          {/* Value Input */}
          <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${responsive.isDesktop ? 'p-6' : 'p-4'}`}>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              💰 Valor Inicial da Sessão (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">R$</span>
              <input
                type="number"
                value={importRouteValue}
                onChange={(e) => setImportRouteValue(e.target.value)}
                placeholder="500.00"
                className="w-full pl-10 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold text-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Botões Import */}
          {!hasRomaneio ? (
            <button
              onClick={handleImport}
              disabled={loading || !file || !importRouteValue}
              className={`w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2 ${responsive.isDesktop ? 'py-4 text-lg' : 'py-3'}`}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              ) : (
                <>
                  <FileUp size={24} />
                  <span>Importar Romaneio</span>
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div className={`grid gap-3 ${responsive.isDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <button
                  onClick={handleImportAdditional}
                  disabled={loading || !file}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FileUp size={20} />
                  {loading ? '...' : '+ Add Outro Romaneio'}
                </button>
                <button
                  onClick={handleSessionReport}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles size={20} />
                  {loading ? '...' : 'Gerar Relatório Completo'}
                </button>
              </div>
              
              <button
                onClick={handleCancelSession}
                disabled={loading}
                className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold py-3 rounded-lg transition-colors border border-red-200 dark:border-red-800/50 text-sm"
              >
                🔴 Cancelar Sessão (Limpar tudo)
              </button>
            </div>
          )}

          {/* Resultado da Importação */}
          {importAnalysis && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full text-green-600">
                  <Sparkles size={24} />
                </div>
                <div>
                  <p className="font-bold text-green-900 dark:text-green-300">Sessão Gerada!</p>
                  <p className="text-sm text-green-800 dark:text-green-400">Próximo: Otimizar e distribuir entregadores</p>
                </div>
              </div>

              {importAnalysis.formatted && (
                <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 ${responsive.isDesktop ? 'p-6' : 'p-4'}`}>
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <TrendingUp size={20} className="text-blue-600" />
                    Análise da Sessão
                  </h4>

                  <div className={`grid gap-3 ${responsive.isDesktop ? 'grid-cols-4' : 'grid-cols-2'}`}>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                      <p className="text-xs text-gray-500 uppercase">Valor</p>
                      <p className="font-bold text-gray-900 dark:text-white text-lg">{importAnalysis.formatted.header?.value}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                      <p className="text-xs text-gray-500 uppercase">Tipo</p>
                      <p className="font-bold text-gray-900 dark:text-white text-lg">{importAnalysis.formatted.header?.type}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                      <p className="text-xs text-gray-500 uppercase">Score</p>
                      <p className="font-bold text-gray-900 dark:text-white text-2xl text-blue-600">{importAnalysis.formatted.header?.score}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                      <p className="text-xs text-gray-500 uppercase">Status</p>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{importAnalysis.formatted.header?.recommendation}</p>
                    </div>
                  </div>

                  <div className={`grid gap-3 ${responsive.isDesktop ? 'grid-cols-4' : 'grid-cols-2'}`}>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <p className="text-xs text-blue-600 font-bold">Ganho/Hora</p>
                      <p className="font-bold text-gray-900 dark:text-white">{importAnalysis.formatted.earnings?.hourly}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <p className="text-xs text-blue-600 font-bold">Ganho/Pct</p>
                      <p className="font-bold text-gray-900 dark:text-white">{importAnalysis.formatted.earnings?.package}</p>
                    </div>
                    <div className={`bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg ${responsive.isDesktop ? 'col-span-2' : 'col-span-2'}`}>
                      <p className="text-xs text-blue-600 font-bold">Tempo Total Est.</p>
                      <p className="font-bold text-gray-900 dark:text-white">{importAnalysis.formatted.earnings?.time_estimate}</p>
                    </div>
                  </div>

                  {importAnalysis.formatted.top_drops?.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">🔥 Top Drops</p>
                      <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
                        {importAnalysis.formatted.top_drops.map((drop, i) => (
                          <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{drop.emoji}</span>
                              <span className="font-semibold text-gray-900 dark:text-white">{drop.street}</span>
                            </div>
                            <span className="text-xs font-bold bg-white dark:bg-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-300">{drop.count} entregas</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {importAnalysis.minimap_url && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 text-white font-bold flex items-center gap-2">
                    <Map size={20} /> Minimapa da Sessão
                  </div>
                  <iframe
                    src={importAnalysis.minimap_url}
                    className="w-full h-96 border-0"
                    title="Minimapa da Sessão"
                    allowFullScreen=""
                  />
                </div>
              )}
            </div>
          )}

          {/* Otimize Section */}
          {hasRomaneio && (
            <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${responsive.isDesktop ? 'p-6' : 'p-4'}`}>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                📍 Quantos Entregadores para dividir?
              </label>
              <div className={`flex gap-3 ${responsive.isDesktop ? 'flex-row items-center' : 'flex-col'}`}>
                <div className="relative flex-1">
                   <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                   <input
                    type="number"
                    min="1"
                    max="10"
                    value={numDeliverers}
                    onChange={(e) => setNumDeliverers(e.target.value)}
                    className="w-full pl-10 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold text-lg"
                  />
                </div>
                <button
                  onClick={handleOptimize}
                  disabled={loading || !hasRomaneio}
                  className={`bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold px-8 py-3 rounded-lg transition-colors shadow-lg hover:shadow-xl ${responsive.isDesktop ? '' : 'w-full'}`}
                >
                  {loading ? 'Processando...' : '🚀 Otimizar Rotas'}
                </button>
              </div>
            </div>
          )}

          {/* Routes & Assignment */}
          {routes.length > 0 && (
            <div className="space-y-4 animate-fade-in-up">
              <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center gap-2">
                <Users size={24} className="text-purple-600" />
                Atribuição de Entregadores
              </h3>
              
              <div className={`grid gap-4 ${responsive.isDesktop ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {routes.map((route, idx) => (
                  <div key={route.route_id} className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-gray-100 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-900 transition-all shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-lg text-gray-900 dark:text-white">Rota {idx + 1}</p>
                        <p className="text-sm text-gray-500">{route.total_stops ?? '-'} paradas • {route.total_packages ?? '-'} pacotes</p>
                      </div>
                      <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-bold">
                        {route.percentage_load ? `${route.percentage_load}% volume` : 'Auto'}
                      </div>
                    </div>

                    {route.map_url && (
                      <div className="mb-4">
                        <a
                          href={route.map_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-bold text-purple-600 dark:text-purple-400 hover:underline bg-purple-50 dark:bg-purple-900/20 px-3 py-2 rounded-lg w-full justify-center transition-colors hover:bg-purple-100"
                        >
                          <Map size={16} /> Ver mapa no Google M.
                        </a>
                      </div>
                    )}
                    
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Entregador Responsável</label>
                    <select
                      value={assignments[route.route_id] || ''}
                      onChange={(e) => handleAssign(route.route_id, e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">-- Selecione --</option>
                      {deliverers.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-4">
                <button
                  onClick={handleStartRoutes}
                  disabled={!allAssigned || loading}
                  className={`w-full ${allAssigned ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'} text-white font-bold py-4 rounded-xl transition-all shadow-lg text-lg flex items-center justify-center gap-2`}
                >
                  {loading ? 'Enviando...' : (
                    <>
                      <Send size={24} />
                      Confirmar e Enviar Rotas
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => (window.location.href = '/?tab=separation')}
                  className="w-full bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Navigation size={20} />
                  Ir para Modo Separação
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BarcodeScanner Modal */}
      {showScanner && (
        <BarcodeScanner 
          onScan={(codes) => {
            if (codes && codes.length > 0) {
              // Adicionar códigos escaneados ao campo de endereços
              const newCodes = codes.join('\n');
              setAddressesText(prev => prev ? prev + '\n' + newCodes : newCodes);
            }
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
