import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Sparkles, MapPin, AlertCircle, Users, Send, Map } from 'lucide-react';

export default function RouteAnalysisView() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [routeValue, setRouteValue] = useState('');
  const [minimapUrl, setMinimapUrl] = useState(null);
  const [deliverers, setDeliverers] = useState([]);
  const [viewMode, setViewMode] = useState('analysis');
  const [hasRomaneio, setHasRomaneio] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionStats, setSessionStats] = useState(null);
  const [numDeliverers, setNumDeliverers] = useState(2);
  const [routes, setRoutes] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [combinedMapUrl, setCombinedMapUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch('/api/admin/team')
      .then(r => r.json())
      .then(setDeliverers)
      .catch(() => setDeliverers([]));
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    const formData = new FormData();
    formData.append('file', file);
    if (routeValue) formData.append('route_value', routeValue);

    try {
      const res = await fetch('/api/route/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Falha ao analisar rota');
      }

      const data = await res.json();
      setAnalysis(data);
      if (data.minimap_url) {
        setMinimapUrl(data.minimap_url);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRouteValue = async () => {
    if (!routeValue) return;
    try {
      await fetch('/api/session/route-value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parseFloat(routeValue) })
      });
    } catch (err) {
      setError('Erro ao salvar valor da rota');
    }
  };

  const handleImport = async () => {
    if (!file || !routeValue) return;

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
      setMinimapUrl(data.minimap_url || null);
      setHasRomaneio(true);
      if (data.session_id) setSessionId(data.session_id);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportAdditional = async () => {
    if (!file || !routeValue || !hasRomaneio) return;

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
        throw new Error(errData.detail || 'Falha ao importar romaneio adicional');
      }

      const data = await res.json();
      setMinimapUrl(data.minimap_url || null);
      if (data.session_id) setSessionId(data.session_id);
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
      setAnalysis(data);
      if (data.minimap_url) setMinimapUrl(data.minimap_url);
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
    setCombinedMapUrl(null);

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

  const handleCombinedMap = async () => {
    try {
      const res = await fetch('/api/routes/combined-map');
      if (!res.ok) {
        const errData = await res.json();

        throw new Error(errData.detail || 'Falha ao gerar mapa completo');
      }
      const data = await res.json();
      setCombinedMapUrl(data.map_url || null);
    } catch (err) {
      setError(err.message);
    }
  };

  const allAssigned = routes.length > 0 && routes.every((r) => assignments[r.route_id]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
          <Sparkles className="text-purple-500" /> Análise de Rota com IA
        </h2>

        <p className="text-sm text-gray-500">
          Envie o romaneio da Shopee (.xlsx) para inteligência verificar se vale a pena.
        </p>
      </div>

      {/* Abas */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setViewMode('analysis')}
          className={`py-3 rounded-xl font-bold text-sm ${viewMode === 'analysis' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700'}`}
        >
          Analisar Rota
        </button>
        <button
          onClick={() => setViewMode('import')}
          className={`py-3 rounded-xl font-bold text-sm ${viewMode === 'import' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700'}`}
        >
          Importar Romaneio
        </button>
      </div>

      {/* Upload Area */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
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
              <p className="font-medium">Toque para selecionar o arquivo</p>
              <p className="text-xs text-gray-400 mt-2">Suporta apenas Romaneio Shopee (.xlsx)</p>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <input
            type="number"
            placeholder="Valor total da rota"
            value={routeValue}
            onChange={(e) => setRouteValue(e.target.value)}
            className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
          />
          <button
            onClick={handleSaveRouteValue}
            className="bg-gray-900 text-white rounded-lg text-sm font-semibold"
          >
            Salvar
          </button>
        </div>

        {viewMode === 'analysis' ? (
          <div className="mt-4">
            <button 
              onClick={handleAnalyze}
              disabled={!file || loading}
              className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30'
              }`}
            >
              {loading ? 'Analisando...' : 'Analisar IA'}
            </button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button 
              onClick={handleImport}
              disabled={!file || loading || !routeValue}
              className={`py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                loading || !routeValue
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
              }`}
            >
              {loading ? 'Importando...' : 'Importar Romaneio'}
            </button>
            <button 
              onClick={handleSessionReport}
              disabled={loading || !hasRomaneio}
              className={`py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                loading || !hasRomaneio
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30'
              }`}
            >
              Gerar Relatório
            </button>
          </div>
        )}

        {viewMode === 'import' && hasRomaneio && (
          <button 
            onClick={handleImportAdditional}
            disabled={!file || loading}
            className={`mt-3 w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
              loading || !file
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'
            }`}
          >
            Importar Outro Romaneio
          </button>
        )}

        {minimapUrl && (
          <a 
            href={minimapUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600"
          >
            <Map size={16} /> Ver minimapa completo
          </a>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle size={20} />
            {error}
          </div>
        )}
      </div>

      {/* Otimização e distribuição */}
      {viewMode === 'import' && (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <h3 className="font-bold flex items-center gap-2">
          <Users size={18} className="text-indigo-500" /> Otimizar e Distribuir
        </h3>

        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            min={1}
            value={numDeliverers}
            onChange={(e) => setNumDeliverers(e.target.value)}
            className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
          />
          <button
            onClick={handleOptimize}
            disabled={!hasRomaneio || !routeValue}
            className={`rounded-lg text-sm font-semibold ${
              !hasRomaneio || !routeValue ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white'
            }`}
          >
            Otimizar
          </button>
        </div>

        {routes.length > 0 && (
          <div className="space-y-3">
            {/* Botão Modo Separação */}
            <button
              onClick={() => window.location.href = '/?tab=separation'}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-4 rounded-xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 transition-all"
            >
              🔄 Iniciar Modo Separação
            </button>

            {routes.map((r) => (
              <div key={r.route_id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{r.route_id}</p>
                    <p className="text-xs text-gray-500">{r.total_packages} pacotes</p>
                  </div>
                  <a href={r.map_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600">Mapa</a>
                </div>
                <div className="mt-3">
                  <select
                    value={assignments[r.route_id] || ''}
                    onChange={(e) => handleAssign(r.route_id, e.target.value)}
                    className="px-2 py-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                  >
                    <option value="">Selecionar entregador</option>
                    {deliverers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {!allAssigned && (
              <div className="text-sm text-red-600 dark:text-red-400">
                Selecione um entregador para cada rota antes de iniciar.
              </div>
            )}

            <button
              onClick={handleStartRoutes}
              disabled={!allAssigned}
              className={`w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${
                allAssigned ? 'bg-emerald-600 text-white' : 'bg-gray-400 text-white cursor-not-allowed'
              }`}
            >
              <Send size={14} /> Iniciar Rota (Enviar para Entregadores)
            </button>
          </div>
        )}

        <button
          onClick={handleCombinedMap}
          className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-semibold"
        >
          Gerar mapa completo colorido
        </button>

        {combinedMapUrl && (
          <a 
            href={combinedMapUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600"
          >
            <Map size={16} /> Ver mapa completo
          </a>
        )}
      </div>
      )}

      {/* Results */}
      {analysis && (
        <div className="space-y-4 animate-fade-in-up">
            {/* Score Card */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-white/80 text-sm mb-1 uppercase tracking-wider">Score Geral</p>
                        <h1 className="text-5xl font-black">{analysis.overall_score.toFixed(1)}<span className="text-2xl font-normal opacity-50">/10</span></h1>
                    </div>
                    <div className="text-right">
                        <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold inline-block mb-1">
                            {analysis.recommendation}
                        </div>
                        <p className="text-sm opacity-90">{analysis.total_packages} pacotes</p>
                    </div>
                </div>
                <div className="mt-4 bg-black/20 p-3 rounded-lg text-sm italic">
                    " {analysis.ai_comment} "
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 mb-1">Distância Tot.</p>
                    <p className="text-xl font-bold">{analysis.total_distance_km.toFixed(1)} km</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 mb-1">Ganho Est.</p>
                    <p className="text-xl font-bold text-green-600">R$ {analysis.route_value?.toFixed(2) || '0.00'}</p>
                </div>
            </div>

            {/* Neighborhoods */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                    <MapPin size={18} className="text-blue-500" /> Bairros Encontrados
                </h3>
                <div className="flex flex-wrap gap-2">
                    {analysis.neighborhood_list && analysis.neighborhood_list.map((bairro, i) => (
                        <span key={i} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
                            {bairro}
                        </span>
                    ))}
                </div>
            </div>

            {/* Pros & Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-green-50 dark:bg-green-900/10 p-5 rounded-xl">
                    <h4 className="text-green-700 dark:text-green-400 font-bold mb-2">Pontos Fortes</h4>
                    <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                        {analysis.pros && analysis.pros.map((p, i) => <li key={i}>✅ {p}</li>)}
                    </ul>
                 </div>
                 <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-xl">
                    <h4 className="text-red-700 dark:text-red-400 font-bold mb-2">Pontos Fracos</h4>
                    <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                        {analysis.cons && analysis.cons.map((c, i) => <li key={i}>⚠️ {c}</li>)}
                    </ul>
                 </div>
            </div>
        </div>
      )}
    </div>
  );
}
