import React, { useState, useRef } from 'react';
import { FileUp, List, Sparkles, MapPin, AlertCircle } from 'lucide-react';

export default function RouteAnalysisView() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

        <button 
          onClick={handleAnalyze}
          disabled={!file || loading}
          className={`mt-4 w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30'
          }`}
        >
          {loading ? 'Analisando com IA...' : 'Analisar Agora'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle size={20} />
            {error}
          </div>
        )}
      </div>

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
