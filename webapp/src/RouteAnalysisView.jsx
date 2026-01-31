import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Sparkles, MapPin, AlertCircle, Users, Send, Map, Zap, TrendingUp } from 'lucide-react';

export default function RouteAnalysisView() {
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

  useEffect(() => {
    fetch('/api/admin/team')
      .then(r => r.json())
      .then(setDeliverers)
      .catch(() => setDeliverers([]));
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
      const res = await fetch('/api/routes/analyze-addresses', {
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
      const res = await fetch('/api/routes/generate-map', {
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
      const res = await fetch('/api/romaneio/import', {
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
      const res = await fetch('/api/session/romaneio/import-additional', {
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
      const res = await fetch('/api/session/report');
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
      const res = await fetch('/api/routes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch('/api/routes/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 shadow-lg text-white">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
          <Sparkles size={32} /> Análise de Rota com IA
        </h2>
        <p className="text-purple-100">
          Cole endereços ou importe romaneio. A IA te diz se vale a pena.
        </p>
      </div>

      {/* Abas Principais */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setViewMode('simple')}
          className={`py-3 px-4 rounded-xl font-bold text-sm transition-all ${
            viewMode === 'simple'
              ? 'bg-purple-600 text-white shadow-lg scale-105'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
          }`}
        >
          <Sparkles size={18} className="inline mr-2" />
          Colar Endereços
        </button>
        <button
          onClick={() => setViewMode('import')}
          className={`py-3 px-4 rounded-xl font-bold text-sm transition-all ${
            viewMode === 'import'
              ? 'bg-blue-600 text-white shadow-lg scale-105'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
          }`}
        >
          <FileUp size={18} className="inline mr-2" />
          Importar Romaneio
        </button>
      </div>

      {/* ERRO GLOBAL */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-red-800 dark:text-red-300">Erro</p>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* ===== ABA 1: COLAR ENDEREÇOS ===== */}
      {viewMode === 'simple' && (
        <div className="space-y-4">
          {/* Input Area */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              📝 Cola os Endereços (um por linha)
            </label>
            <textarea
              value={addressesText}
              onChange={(e) => setAddressesText(e.target.value)}
              placeholder={`Rua Principado de Mônaco, 37, Apt 501
Rua Mena Barreto, 161, Loja BMRIO
Rua General Polidoro, 322, 301
...`}
              className="w-full h-48 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              {addressesText.trim().split('\n').length} endereço(s) detectado(s)
            </p>
          </div>

          {/* Value Input */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              💰 Valor Total da Rota
            </label>
            <input
              type="number"
              value={simpleRouteValue}
              onChange={(e) => setSimpleRouteValue(e.target.value)}
              placeholder="Ex: 150.00"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Botões */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleAnalyzeAddresses}
              disabled={simpleLoading || !addressesText.trim() || !simpleRouteValue}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Zap size={20} />
              {simpleLoading ? 'Analisando...' : 'Analisar IA'}
            </button>
            <button
              onClick={handleClearSimple}
              className="bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-3 rounded-lg transition-colors"
            >
              Limpar
            </button>
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
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm opacity-80">Valor</p>
                    <p className="text-2xl font-bold">{simpleAnalysis.header?.['💰 VALOR']}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-80">Tipo</p>
                    <p className="text-2xl font-bold">{simpleAnalysis.header?.['⭐ TIPO']}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-3">
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
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
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
                  <p className="font-bold text-green-600">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-gray-700 dark:text-gray-300">Clique ou arraste arquivo Excel</p>
                  <p className="text-sm text-gray-500">Suporta .xlsx ou .xls (Shopee)</p>
                </div>
              )}
            </div>
          </div>

          {/* Value Input */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              💰 Valor Inicial da Sessão
            </label>
            <input
              type="number"
              value={importRouteValue}
              onChange={(e) => setImportRouteValue(e.target.value)}
              placeholder="Ex: 500.00"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Botões Import */}
          {!hasRomaneio ? (
            <button
              onClick={handleImport}
              disabled={loading || !file || !importRouteValue}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <FileUp size={20} />
              {loading ? 'Importando...' : 'Importar Romaneio'}
            </button>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleImportAdditional}
                disabled={loading || !file}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <FileUp size={20} />
                {loading ? 'Importando...' : 'Importar Mais um Romaneio'}
              </button>
              <button
                onClick={handleSessionReport}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Gerando...' : '📊 Gerar Relatório Completo'}
              </button>
            </div>
          )}

          {/* Resultado da Importação */}
          {importAnalysis && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <p className="font-bold text-green-900 dark:text-green-300">✅ Sessão Análise Gerada!</p>
              <p className="text-sm text-green-800 dark:text-green-400">Próximo: Otimizar e distribuir entregadores</p>
            </div>
          )}

          {/* Otimize Section */}
          {hasRomaneio && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                📍 Quantos Entregadores?
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numDeliverers}
                  onChange={(e) => setNumDeliverers(e.target.value)}
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleOptimize}
                  disabled={loading || !hasRomaneio}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold px-6 py-3 rounded-lg transition-colors"
                >
                  {loading ? '...' : '🚀 Otimizar'}
                </button>
              </div>
            </div>
          )}

          {/* Routes & Assignment */}
          {routes.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-gray-900 dark:text-white">Atribua Entregadores</h3>
              {routes.map((route, idx) => (
                <div key={route.route_id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <p className="font-bold text-gray-900 dark:text-white mb-3">
                    Rota {idx + 1}: {route.stops} paradas, {route.packages} pacotes
                  </p>
                  <select
                    value={assignments[route.route_id] || ''}
                    onChange={(e) => handleAssign(route.route_id, e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">-- Selecione Entregador --</option>
                    {deliverers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                onClick={handleStartRoutes}
                disabled={!allAssigned || loading}
                className={`w-full ${allAssigned ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'} text-white font-bold py-3 rounded-lg transition-colors`}
              >
                {loading ? 'Enviando...' : '✅ Iniciar Rotas'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
