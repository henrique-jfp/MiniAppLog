import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Calendar } from 'lucide-react';

export default function FinancialView({ data }) {
  if (!data) return <div className="p-8 text-center text-gray-500">Carregando finanças...</div>;

  if (data.view === 'personal') {
    return <PersonalFinancialView data={data} />;
  }

  if (data.view === 'company') {
    return <CompanyFinancialView data={data} />;
  }

  return <div>Tipo de visualização desconhecido.</div>;
}

function PersonalFinancialView({ data }) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 opacity-90 mb-2">
          <Wallet size={20} />
          <span className="text-sm font-medium">Seus Ganhos ({data.period})</span>
        </div>
        <div className="text-4xl font-bold flex items-baseline gap-1">
          <span className="text-2xl opacity-80">R$</span>
          {data.balance.toFixed(2).replace('.', ',')}
        </div>
        <div className="mt-4 pt-4 border-t border-white/20 text-xs opacity-80 flex justify-between">
            <span>Pagamento previsto: Sexta-feira</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-white font-bold">A RECEBER</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 text-sm uppercase tracking-wide">Extrato Recente</h3>
        <div className="space-y-3">
            {/* Lista Mockada para exemplo visual - Em produção, viria da API */}
            <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <div className="flex flex-col">
                    <span className="font-medium text-sm">Rota de Hoje</span>
                    <span className="text-xs text-gray-400">Processando...</span>
                </div>
                <span className="text-gray-400 font-mono text-sm">--</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <div className="flex flex-col">
                    <span className="font-medium text-sm">Rota Ontem</span>
                    <span className="text-xs text-green-600">Concluída</span>
                </div>
                <span className="text-green-600 font-bold font-mono text-sm">+ R$ {((data.balance > 0 ? data.balance : 50) * 0.4).toFixed(2).replace('.', ',')}</span>
            </div>
             <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <div className="flex flex-col">
                    <span className="font-medium text-sm">Bônus Meta</span>
                    <span className="text-xs text-blue-500">Extra</span>
                </div>
                <span className="text-blue-600 font-bold font-mono text-sm">+ R$ {((data.balance > 0 ? data.balance : 50) * 0.1).toFixed(2).replace('.', ',')}</span>
            </div>
        </div>
      </div>
    </div>
  );
}

function CompanyFinancialView({ data }) {
  const { revenue, costs, profit } = data.company_stats;

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign size={100} />
        </div>
        <h2 className="text-sm font-medium text-gray-400 mb-1">Lucro Líquido ({data.period})</h2>
        <div className={`text-4xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          R$ {profit.toFixed(2).replace('.', ',')}
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white/10 p-3 rounded-lg">
                <div className="flex items-center gap-1 text-green-300 text-xs mb-1">
                    <TrendingUp size={12} /> Receita
                </div>
                <div className="font-semibold text-lg">R$ {revenue.toFixed(0)}</div>
            </div>
            <div className="bg-white/10 p-3 rounded-lg">
                <div className="flex items-center gap-1 text-red-300 text-xs mb-1">
                    <TrendingDown size={12} /> Custos
                </div>
                <div className="font-semibold text-lg">R$ {costs.toFixed(0)}</div>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <UsersIcon /> Repasse aos Entregadores
        </h3>
        <div className="space-y-4">
            {Object.entries(data.deliverers_stats).map(([name, val], idx) => (
                <div key={idx} className="flex justify-between items-center group">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                            {name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{name}</span>
                    </div>
                    <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                        R$ {val.toFixed(2).replace('.', ',')}
                    </span>
                </div>
            ))}
             {Object.keys(data.deliverers_stats).length === 0 && (
                <div className="text-center text-gray-400 text-sm py-2">Nenhum repasse registrado ainda.</div>
            )}
        </div>
      </div>
    </div>
  );
}

const UsersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
)
