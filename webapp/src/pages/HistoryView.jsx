import React, { useState, useEffect } from 'react';
import { Archive, MapPin, Users, DollarSign, Calendar, ChevronDown, Download } from 'lucide-react';

const HistoryView = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);
  const [filter, setFilter] = useState('all');
  const [activeSession, setActiveSession] = useState(null);

  // Carregar histórico de sessões
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/history/sessions?limit=100');
      const data = await response.json();
      setSessions(data.sessions || []);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      setLoading(false);
    }
  };

  // Retomar sessão - carregar estado completo
  const handleResumeSession = async (sessionId) => {
    try {
      const response = await fetch(`/api/session/${sessionId}/resume`);
      if (!response.ok) throw new Error('Erro ao carregar sessão');
      const data = await response.json();
      
      // Salva sessão no localStorage para recuperação
      localStorage.setItem('resuming_session', JSON.stringify(data));
      localStorage.setItem('current_session_id', sessionId);
      localStorage.setItem('resume_tab', data.resume_tab);
      localStorage.setItem('current_step', data.current_step);
      
      // Redireciona para a aba CERTA baseado no passo
      window.location.href = `/?tab=${data.resume_tab}&session_id=${sessionId}`;
    } catch (error) {
      console.error('Erro ao retomar sessão:', error);
      alert('Erro ao carregar sessão. Tente novamente.');
    }
  };

  // Formatar moeda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  // Formatar data
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  // Calcular duração
  const calculateDuration = (created, completed) => {
    if (!created || !completed) return '-';
    const start = new Date(created);
    const end = new Date(completed);
    const minutes = Math.round((end - start) / 60000);
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  // Baixar relatório CSV
  const handleDownloadReport = async (sessionId) => {
    try {
      // Implementar endpoint para export CSV
      window.open(`/api/session/${sessionId}/export`, '_blank');
    } catch (error) {
      console.error('Erro ao baixar relatório:', error);
    }
  };

  // Filtrar sessões
  const filteredSessions = filter === 'all' 
    ? sessions 
    : sessions.filter(s => s.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Archive className="w-12 h-12 mx-auto text-gray-400 animate-pulse mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Archive className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              📚 Histórico de Sessões
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            {filteredSessions.length} sessão(ões) finalizada(s)
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {['all', 'read_only', 'completed'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === status
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {status === 'all' ? 'Todas' : status === 'read_only' ? 'Histórico' : 'Completas'}
            </button>
          ))}
        </div>

        {/* Lista de Sessões */}
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
            <Archive className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Nenhuma sessão finalizada ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition overflow-hidden cursor-pointer group"
              >
                {/* Card Header - Clicável */}
                <div
                  onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                  className="w-full p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        Sessão #{session.id.slice(0, 8)}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Criada</p>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {formatDate(session.created_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Endereços</p>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {session.addresses_count || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Entregadores</p>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {session.deliverers_count || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Duração</p>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {calculateDuration(session.created_at, session.completed_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Botão Retomar */}
                    {!session.is_completed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResumeSession(session.id);
                        }}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-sm transition flex items-center gap-2"
                      >
                        ▶️ Retomar
                      </button>
                    )}
                    <ChevronDown
                      className={`w-6 h-6 text-gray-400 transition-transform ${expandedSession === session.id ? 'transform rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedSession === session.id && (
                  <div className="border-t dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-700/30">
                    {/* Financeiro */}
                    {session.financials && (
                      <div className="mb-6">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <DollarSign className="w-5 h-5" />
                          Resumo Financeiro
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Lucro Total</p>
                            <p className="text-2xl font-bold text-green-600">
                              {formatCurrency(session.financials.total_profit)}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Custos</p>
                            <p className="text-2xl font-bold text-red-600">
                              {formatCurrency(session.financials.total_cost)}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Salários</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {formatCurrency(session.financials.total_salary)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Estatísticas */}
                    {session.statistics && Object.keys(session.statistics).length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-4">
                          📊 Estatísticas
                        </h4>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg text-sm space-y-2">
                          {Object.entries(session.statistics).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400 capitalize">
                                {key.replace(/_/g, ' ')}:
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {typeof value === 'number' ? value.toFixed(2) : value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="mb-6">
                      <h4 className="font-bold text-gray-900 dark:text-white mb-4">ℹ️ Informações</h4>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">ID</span>
                          <span className="font-mono text-gray-900 dark:text-white">{session.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Status</span>
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs font-medium">
                            {session.status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Atualizado</span>
                          <span className="text-gray-900 dark:text-white">
                            {formatDate(session.last_updated)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownloadReport(session.id)}
                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Exportar Relatório
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
