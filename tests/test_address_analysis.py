#!/usr/bin/env python3
"""
Test script para validar análise de endereços com os dados do print
"""
import sys
sys.path.insert(0, '/root' if sys.platform != 'win32' else 'c:\\BotEntregador')

from bot_multidelivery.services.route_analyzer import RouteAnalyzer

# Os 27 endereços do print fornecido
test_addresses = """Rua Principado de Mônaco, 37, Apt 501(guarita tb pode deixar
Rua Mena Barreto, 151, Portaria
Rua Mena Barreto, 161, Apt;605 bloco 2
Rua Mena Barreto, 161, Bloco 2 apt. 1002
Rua Mena Barreto, 161, Loja BMRIO
Rua Mena Barreto, 161, Bl 2  ap 206
Rua Real Grandeza, 278, 601
Rua Principado de Mônaco apt 201, 68, Perto de um posto de gasolina
Rua Real Grandeza, 314, Unicesumar INTERFONE 28
Rua General Polidoro, 322, 301
Rua General Polidoro, 322, 301
Rua General Polidoro, 322, 301
Rua Real Grandeza, 301, Consultora de oficina paula
Rua Real Grandeza, 308, Loja c depósito bebida
Rua General Polidoro, 322, 204
Rua General Polidoro, 322, Cobertura 95.
Rua Real Grandeza, 312
Rua Real Grandeza, 312
Rua General Polidoro, 322, 95 cb
Rua General Polidoro, 322, 95 cb
Rua General Polidoro, 322, 402
Rua São João Batista, 57, Joaquina
Rua São João Batista, 27
Rua São João Batista, 27
Rua São João Batista, 22, Loja Isso nao é uma Barbearia
Rua São João Batista, 21, Apto 403
Rua Voluntários da Pátria, 249, Apartamento 902
Rua Voluntários da Pátria, 220, 802
Rua Voluntários da Pátria, 230, Apto 604"""

# Valor de teste
route_value = 180.00

# Analisa
analyzer = RouteAnalyzer()
result = analyzer.analyze_addresses_from_text(
    addresses_text=test_addresses,
    route_value=route_value
)

# Printa resultados
print("=" * 80)
print("RESULTADO DA ANÁLISE")
print("=" * 80)
print(f"\n📊 SCORE: {result.overall_score}/10 - {result.recommendation}")
print(f"💰 VALOR: R$ {result.route_value:.2f}")
print(f"⭐ TIPO: {result.route_type}")
print(f"⏱️  TEMPO ESTIMADO: {result.estimated_time_minutes:.0f} minutos")
print(f"💵 GANHO/HORA: R$ {result.hourly_earnings:.2f}/h")
print(f"💵 GANHO/PACOTE: R$ {result.package_earnings:.2f}")

print(f"\n📊 PERFIL DA ROTA:")
print(f"  • Total de Pacotes: {result.total_packages}")
print(f"  • Paradas Únicas: {result.total_stops}")
print(f"  • Endereços Comerciais: {result.commercial_count} ({result.commercial_percentage:.1f}%)")
print(f"  • Endereços Verticais (Apts): {result.vertical_count}")
print(f"  • Densidade: {result.density_score:.0f} pkg/km²")
print(f"  • Concentração: {result.concentration_score:.1f}/10")

print(f"\n🔥 TOP 3 DROPS (Ruas com Maior Concentração):")
for i, (street, count) in enumerate(result.top_drops, 1):
    pct = (count / result.total_packages) * 100
    print(f"  {i}. {street}: {count} endereços ({pct:.1f}%)")

print(f"\n✅ PRÓS:")
for pro in result.pros:
    print(f"  ✓ {pro}")

print(f"\n⚠️  CONTRAS:")
for con in result.cons:
    print(f"  ✗ {con}")

print(f"\n🤖 COMENTÁRIO DA IA:")
print("-" * 80)
print(result.ai_comment)
print("-" * 80)

print(f"\n{'='*80}")
print(f"FIM DA ANÁLISE")
print(f"{'='*80}")
