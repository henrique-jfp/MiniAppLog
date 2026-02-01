import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Shield, Truck, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { fetchWithAuth } from './api_client';

export default function TeamView() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', telegram_id: '', is_partner: false });
  const [pendingTransfers, setPendingTransfers] = useState([]);

  // Fetch Team
  const refreshTeam = () => {
    setLoading(true);
    fetchWithAuth('/api/admin/team')
      .then(r => r.json())
      .then(data => {
        setTeam(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    refreshTeam();
    refreshTransfers();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newMember.name || !newMember.telegram_id) return;

    const res = await fetchWithAuth('/api/admin/team', {
      method: 'POST',
      body: JSON.stringify({
        ...newMember,
        telegram_id: parseInt(newMember.telegram_id)
      })
    });

    if (res.ok) {
      setShowModal(false);
      setNewMember({ name: '', telegram_id: '', is_partner: false });
      refreshTeam();
    } else {
      alert("Erro ao adicionar member");
    }
  };

  const handleRemove = async (id) => {
    if (!confirm('Tem certeza que deseja remover este entregador?')) return;
    
    await fetchWithAuth(`/api/admin/team/${id}`, { method: 'DELETE' });
    refreshTeam();
  };

  const refreshTransfers = async () => {
    try {
      const res = await fetchWithAuth('/api/delivery/pending-transfers');
      const data = await res.json();
      setPendingTransfers(data.transfers || []);
    } catch (err) {
      console.error('Erro ao buscar transferências:', err);
    }
  };

  const handleApproveTransfer = async (transferId, approved, rejectionReason = '') => {
    try {
      const adminId = 123456; // TODO: pegar do contexto
      const adminName = 'Admin'; // TODO: pegar do contexto
      
      const res = await fetchWithAuth('/api/delivery/transfer-approve', {
        method: 'POST',
        body: JSON.stringify({
          transfer_id: transferId,
          approved,
          admin_id: adminId,
          admin_name: adminName,
          rejection_reason: rejectionReason
        })
      });

      if (res.ok) {
        alert(approved ? 'Transferência aprovada!' : 'Transferência rejeitada!');
        refreshTransfers();
      }
    } catch (err) {
      alert('Erro ao processar transferência');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="text-blue-500" /> Gestão de Equipe
          </h2>
          <p className="text-sm text-gray-500">Gerencie seus entregadores e parceiros</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg shadow-lg shadow-blue-500/30 transition-all active:scale-95"
        >
          <UserPlus size={20} />
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-gray-500 py-10">Carregando equipe...</div>
        ) : team.length === 0 ? (
          <div className="text-center text-gray-400 py-10 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300">
            Nenhum membro na equipe ainda.
          </div>
        ) : (
          team.map(member => (
            <div key={member.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center group">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                  member.is_partner 
                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' 
                    : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300'
                }`}>
                  {member.name.substring(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold flex items-center gap-2">
                    {member.name}
                    {member.is_partner && <Shield size={14} className="text-purple-500" title="Sócio" />}
                  </h3>
                  <div className="flex gap-3 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><Truck size={10} /> {member.deliveries} entregas</span>
                    <span className="font-mono">ID: {member.id}</span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => handleRemove(member.id)}
                className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Painel de Transferências Pendentes */}
      {pendingTransfers.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-yellow-800 dark:text-yellow-200">
            <AlertCircle size={20} /> Solicitações de Transferência Pendentes ({pendingTransfers.length})
          </h3>
          <div className="space-y-3">
            {pendingTransfers.map((transfer) => (
              <div key={transfer.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-sm">
                      {transfer.from_deliverer.name} → {transfer.to_deliverer.name}
                    </p>
                    <p className="text-xs text-gray-500">{transfer.package_count} pacote(s)</p>
                  </div>
                  <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">
                    Pendente
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <strong>Motivo:</strong> {transfer.reason}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveTransfer(transfer.id, true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-semibold transition"
                  >
                    <CheckCircle size={16} /> Aprovar
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Motivo da rejeição (opcional):');
                      handleApproveTransfer(transfer.id, false, reason || '');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition"
                  >
                    <XCircle size={16} /> Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Add */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold mb-4">Novo Entregador</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Nome</label>
                <input 
                  type="text" 
                  required
                  className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-lg p-3 outline-none focus:ring-2 ring-blue-500"
                  placeholder="Ex: João Silva"
                  value={newMember.name}
                  onChange={e => setNewMember({...newMember, name: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">Telegram ID</label>
                <input 
                  type="number" 
                  required
                  className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-lg p-3 outline-none focus:ring-2 ring-blue-500 font-mono"
                  placeholder="Ex: 123456789"
                  value={newMember.telegram_id}
                  onChange={e => setNewMember({...newMember, telegram_id: e.target.value})}
                />
                <p className="text-[10px] text-gray-400 mt-1">Peça pro entregador enviar /id para o bot.</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="is_partner"
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  checked={newMember.is_partner}
                  onChange={e => setNewMember({...newMember, is_partner: e.target.checked})}
                />
                <label htmlFor="is_partner" className="text-sm font-medium">Sócio (Não recebe por pacote)</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
