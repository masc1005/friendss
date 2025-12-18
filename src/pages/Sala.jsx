import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { realizarSorteio } from '../lib/sorteio'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Toast } from '../components/Toast'
import confetti from 'canvas-confetti'
import { QRCodeSVG } from 'qrcode.react'

export function Sala() {
  const { id: salaId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const hostId = searchParams.get('host')
  const isHost = !!hostId

  const [nome, setNome] = useState('')
  const [participantes, setParticipantes] = useState([])
  const [sala, setSala] = useState(null)
  const [meuId, setMeuId] = useState(null)
  const [meuAmigoSecreto, setMeuAmigoSecreto] = useState(null)
  const [isEntering, setIsEntering] = useState(false)
  const [isSorteando, setIsSorteando] = useState(false)
  const [toast, setToast] = useState(null)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [isSaindo, setIsSaindo] = useState(false)
  const [tempoRestante, setTempoRestante] = useState(null)
  const [salaExpirando, setSalaExpirando] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [salaNotFound, setSalaNotFound] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)

  // Carregar dados da sala
  useEffect(() => {
    if (!salaId) return

    const carregarSala = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('salas')
        .select('*')
        .eq('id', salaId)
        .single()

      if (error || !data) {
        setSalaNotFound(true)
        setIsLoading(false)
        return
      }

      setSala(data)
      setIsLoading(false)
    }

    carregarSala()
  }, [salaId, navigate])

  // Carregar participantes e configurar realtime
  useEffect(() => {
    if (!salaId) return

    const carregarParticipantes = async () => {
      const { data } = await supabase
        .from('participantes')
        .select('*')
        .eq('sala_id', salaId)
        .order('criado_em', { ascending: true })

      if (data) {
        setParticipantes(data)
        
        // Se for host, encontrar o ID do participante
        if (isHost) {
          const hostParticipante = data.find(p => p.is_host)
          if (hostParticipante) {
            setMeuId(hostParticipante.id)
            if (hostParticipante.amigo_secreto) {
              setMeuAmigoSecreto(hostParticipante.amigo_secreto)
            }
          }
        }
      }
    }

    carregarParticipantes()

    // Subscription para mudanças em tempo real
    const channel = supabase
      .channel(`sala:${salaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participantes',
          filter: `sala_id=eq.${salaId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setParticipantes(prev => [...prev, payload.new])
            setToast(`👤 ${payload.new.nome} entrou na sala!`)
          } else if (payload.eventType === 'UPDATE') {
            setParticipantes(prev =>
              prev.map(p => p.id === payload.new.id ? payload.new : p)
            )
            // Se atualizou meu amigo secreto
            if (payload.new.id === meuId && payload.new.amigo_secreto) {
              setMeuAmigoSecreto(payload.new.amigo_secreto)
            }
          } else if (payload.eventType === 'DELETE') {
            setParticipantes(prev => {
              const participante = prev.find(p => p.id === payload.old.id)
              if (participante && participante.id !== meuId) {
                setToast(`👋 ${participante.nome} saiu da sala`)
              }
              return prev.filter(p => p.id !== payload.old.id)
            })
          }
        }
      )
      .subscribe()

    // Subscription para mudanças na sala (sorteio)
    const salaChannel = supabase
      .channel(`sala_status:${salaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'salas',
          filter: `id=eq.${salaId}`
        },
        (payload) => {
          setSala(payload.new)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'salas',
          filter: `id=eq.${salaId}`
        },
        () => {
          if (!isHost) {
            setToast('🚪 A sala foi encerrada pelo host')
            setTimeout(() => navigate('/'), 2000)
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      salaChannel.unsubscribe()
    }
  }, [salaId, isHost, meuId])

  // Gerenciar expiração da sala
  useEffect(() => {
    if (!sala || !isHost) return

    const calcularExpiracao = () => {
      const criadaEm = new Date(sala.criada_em)
      const agora = new Date()
      
      let tempoLimite
      if (sala.sorteada) {
        // 5 minutos após sortear
        tempoLimite = 5 * 60 * 1000
      } else {
        // 1 hora sem sortear
        tempoLimite = 60 * 60 * 1000
      }

      const tempoDecorrido = agora - criadaEm
      const tempoRestanteMs = tempoLimite - tempoDecorrido

      return Math.max(0, tempoRestanteMs)
    }

    const atualizarTempo = () => {
      const restante = calcularExpiracao()
      setTempoRestante(restante)

      // Mostrar aviso quando faltar menos de 1 minuto
      if (restante > 0 && restante < 60000 && !salaExpirando) {
        setSalaExpirando(true)
        setToast('⚠️ A sala será encerrada em breve!')
      }

      // Auto-deletar sala quando expirar
      if (restante === 0 && isHost) {
        supabase.from('salas').delete().eq('id', salaId)
        setToast('⏰ Tempo esgotado! Sala encerrada.')
        setTimeout(() => navigate('/'), 2000)
      }
    }

    // Atualizar a cada segundo
    atualizarTempo()
    const interval = setInterval(atualizarTempo, 1000)

    return () => clearInterval(interval)
  }, [sala, isHost, salaId, navigate, salaExpirando])

  // Cleanup ao desmontar (navegação interna)
  useEffect(() => {
    return () => {
      // Limpar quando sair da página via navegação do React Router
      if (isHost && salaId) {
        supabase.from('salas').delete().eq('id', salaId)
      } else if (meuId && !isSaindo) {
        supabase.from('participantes').delete().eq('id', meuId)
      }
    }
  }, [isHost, salaId, meuId, isSaindo])

  // Confirmação ao fechar/recarregar página durante sorteio ativo
  useEffect(() => {
    if (!sala?.sorteada || !meuId) return

    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = 'Tem certeza? Você já recebeu seu amigo secreto!'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [sala?.sorteada, meuId])

  const handleEntrarSala = async () => {
    if (!nome.trim()) return

    // Verificar se já existe alguém com esse nome
    const nomeExistente = participantes.find(
      p => p.nome.toLowerCase() === nome.trim().toLowerCase()
    )

    if (nomeExistente) {
      alert('Já existe alguém com esse nome na sala. Escolha outro nome.')
      return
    }

    setIsEntering(true)

    try {
      const { data, error } = await supabase
        .from('participantes')
        .insert({
          sala_id: salaId,
          nome: nome.trim(),
          is_host: false
        })
        .select()
        .single()

      if (error) throw error

      setMeuId(data.id)
      setNome('')
    } catch (error) {
      console.error('Erro ao entrar na sala:', error)
      alert('Erro ao entrar na sala. Tente novamente.')
    } finally {
      setIsEntering(false)
    }
  }

  const handleSortear = async () => {
    if (participantes.length < 5) {
      alert('É necessário no mínimo 5 participantes para sortear!')
      return
    }

    setIsSorteando(true)

    try {
      // Realizar sorteio
      const resultados = realizarSorteio(participantes)

      // Atualizar cada participante com seu amigo secreto
      for (const resultado of resultados) {
        await supabase
          .from('participantes')
          .update({ amigo_secreto: resultado.amigo_secreto })
          .eq('id', resultado.id)
      }

      // Marcar sala como sorteada
      await supabase
        .from('salas')
        .update({ sorteada: true })
        .eq('id', salaId)

      // Confetti!
      confetti({
        particleCount: 150,
        spread: 180,
        origin: { y: 0.6 }
      })

      setToast('🎉 Sorteio realizado! Todos receberam seu amigo secreto!')
    } catch (error) {
      console.error('Erro ao sortear:', error)
      alert(error.message || 'Erro ao realizar sorteio')
    } finally {
      setIsSorteando(false)
    }
  }

  const formatarTempo = (ms) => {
    if (!ms) return ''
    
    const segundos = Math.floor(ms / 1000)
    const minutos = Math.floor(segundos / 60)
    const segundosRestantes = segundos % 60

    if (minutos > 0) {
      return `${minutos}:${segundosRestantes.toString().padStart(2, '0')}`
    }
    return `${segundos}s`
  }

  const copiarLink = () => {
    const link = window.location.origin + `/sala/${salaId}`
    navigator.clipboard.writeText(link)
    setLinkCopiado(true)
    setToast('📋 Link copiado!')
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  const compartilharLink = async () => {
    const link = window.location.origin + `/sala/${salaId}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Friendss - Amigo Secreto',
          text: 'Entre na sala de amigo secreto!',
          url: link
        })
        setToast('🎉 Link compartilhado!')
      } catch (error) {
        if (error.name !== 'AbortError') {
          copiarLink()
        }
      }
    } else {
      copiarLink()
    }
  }

  const handleSairSala = async () => {
    if (!meuId) return
    
    setIsSaindo(true)

    try {
      await supabase.from('participantes').delete().eq('id', meuId)
      setToast('👋 Você saiu da sala')
      setTimeout(() => navigate('/'), 1000)
    } catch (error) {
      console.error('Erro ao sair:', error)
      setIsSaindo(false)
    }
  }

  const handleEncerrarSala = async () => {
    if (!isHost || !salaId) return

    const confirmar = window.confirm(
      'Tem certeza que deseja encerrar a sala? Todos os participantes serão desconectados.'
    )

    if (!confirmar) return

    setIsSaindo(true)

    try {
      await supabase.from('salas').delete().eq('id', salaId)
      setToast('🚪 Sala encerrada')
      setTimeout(() => navigate('/'), 1000)
    } catch (error) {
      console.error('Erro ao encerrar sala:', error)
      setIsSaindo(false)
    }
  }

  const meuNome = participantes.find(p => p.id === meuId)?.nome

  // Tela de loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-6xl animate-bounce-slow">🎁</div>
          <h2 className="text-2xl font-bold text-slate-100">Carregando sala...</h2>
          <div className="flex gap-2 justify-center">
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    )
  }

  // Tela de erro 404 - sala não encontrada
  if (salaNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl">🔍</div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-100">Sala não encontrada</h2>
            <p className="text-slate-400 text-lg">
              Esta sala não existe ou já foi encerrada.
            </p>
          </div>
          <Button onClick={() => navigate('/')} className="w-full">
            🏠 Voltar para Início
          </Button>
        </div>
      </div>
    )
  }

  // Tela de entrada (não entrou ainda)
  if (!meuId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">🎁</h1>
            <h2 className="text-2xl font-bold text-slate-100">
              Entrar na Sala
            </h2>
            <p className="text-slate-400">Digite seu nome para participar</p>
          </div>

          <Card className="p-6 space-y-4">
            <input
              type="text"
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEntrarSala()}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-slate-100 placeholder-slate-500"
              disabled={isEntering}
            />

            <Button
              onClick={handleEntrarSala}
              disabled={!nome.trim() || isEntering}
              className="w-full"
            >
              {isEntering ? 'Entrando...' : '✨ Entrar na Sala'}
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  // Tela principal da sala
  return (
    <div className="min-h-screen p-3 sm:p-4 py-6 sm:py-8 relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-48 sm:w-72 h-48 sm:h-72 bg-primary/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-40 left-10 w-64 sm:w-96 h-64 sm:h-96 bg-secondary/10 rounded-full blur-3xl animate-float-delayed"></div>
      </div>

      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center space-y-2 sm:space-y-3">
          <div className="relative inline-block">
            <h1 className="text-4xl sm:text-6xl animate-bounce-slow">🎁</h1>
            <div className="absolute -top-1 -right-1 text-xl sm:text-2xl animate-spin-slow">✨</div>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent px-4">
            Sala de Amigo Secreto
          </h2>
          {isHost && (
            <span className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-primary to-secondary rounded-full text-xs sm:text-sm font-bold shadow-lg">
              ⭐ Host
            </span>
          )}
          
          {/* Contagem regressiva */}
          {tempoRestante !== null && isHost && (
            <div className={`inline-block px-3 sm:px-4 py-2 rounded-xl shadow-lg max-w-[90vw] ${
              tempoRestante < 60000 
                ? 'bg-red-500/20 border-2 border-red-500 text-red-400 animate-pulse' 
                : 'bg-slate-800/80 backdrop-blur-sm border-2 border-slate-700 text-slate-300'
            }`}>
              <span className="text-xs sm:text-sm font-bold flex items-center gap-1 sm:gap-2">
                <span className="text-base sm:text-lg">{sala?.sorteada ? '⏱️' : '⏲️'}</span>
                <span className="hidden sm:inline">{sala?.sorteada ? 'Sala encerra em: ' : 'Expira em: '}</span>
                <span className="sm:hidden">{sala?.sorteada ? 'Encerra: ' : 'Expira: '}</span>
                <span className="font-mono text-sm sm:text-base">{formatarTempo(tempoRestante)}</span>
              </span>
            </div>
          )}

          <div>
            {isHost ? (
              <Button 
                onClick={handleEncerrarSala} 
                variant="secondary" 
                disabled={isSaindo}
                className="text-xs sm:text-sm"
              >
                {isSaindo ? '🚪 Encerrando...' : '🚪 Encerrar Sala'}
              </Button>
            ) : (
              <Button 
                onClick={handleSairSala} 
                variant="secondary" 
                disabled={isSaindo}
                className="text-xs sm:text-sm"
              >
                {isSaindo ? '👋 Saindo...' : '👋 Sair da Sala'}
              </Button>
            )}
          </div>
        </div>

        {/* Link da sala */}
        <Card className="p-4 sm:p-5 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-600">
          <div className="space-y-3">
            <label className="text-xs sm:text-sm font-semibold text-slate-400 flex items-center gap-2">
              <span>🔗</span> Link da Sala
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={`${window.location.origin}/sala/${salaId}`}
                readOnly
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-slate-900/80 border-2 border-slate-700 rounded-xl text-slate-300 text-xs sm:text-sm font-mono hover:border-slate-600 transition-colors"
              />
              <div className="flex gap-2">
                <Button 
                  variant="secondary" 
                  onClick={copiarLink} 
                  className="whitespace-nowrap hover:scale-105 flex-1 sm:flex-none"
                >
                  {linkCopiado ? '✓ Copiado' : '📋 Copiar'}
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={compartilharLink} 
                  className="whitespace-nowrap hover:scale-105 flex-1 sm:flex-none"
                >
                  🚀 Compartilhar
                </Button>
              </div>
            </div>
            <button
              onClick={() => setShowQRCode(!showQRCode)}
              className="text-xs sm:text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-2 mx-auto"
            >
              <span>{showQRCode ? '🔼' : '🔽'}</span>
              {showQRCode ? 'Ocultar QR Code' : 'Mostrar QR Code'}
            </button>
            {showQRCode && (
              <div className="flex justify-center pt-2 pb-1">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG 
                    value={`${window.location.origin}/sala/${salaId}`}
                    size={200}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Resultado do sorteio */}
        {meuAmigoSecreto && (
          <Card className="p-6 sm:p-8 border-4 border-primary bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl shadow-primary/30 animate-slideIn">
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="text-3xl sm:text-4xl">🎉</div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-200">
                Seu amigo secreto é:
              </h3>
              <div className="relative inline-block px-2">
                <p className="text-4xl sm:text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 drop-shadow-2xl animate-pulse-slow py-4 break-words">
                  {meuAmigoSecreto}
                </p>
                <div className="absolute -top-2 -right-2 text-2xl sm:text-3xl animate-spin-slow">✨</div>
                <div className="absolute -bottom-2 -left-2 text-2xl sm:text-3xl animate-spin-slow" style={{ animationDelay: '0.5s' }}>✨</div>
              </div>
              <p className="text-sm sm:text-base text-slate-400 font-medium flex items-center justify-center gap-2">
                <span className="text-xl sm:text-2xl">🤫</span> Mantenha em segredo!
              </p>
            </div>
          </Card>
        )}

        {/* Lista de participantes */}
        <Card className="p-4 sm:p-6 bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
                <span className="text-xl sm:text-2xl">👥</span> 
                Participantes 
                <span className="text-primary">({participantes.length})</span>
              </h3>
              {participantes.length < 5 && (
                <span className="text-xs sm:text-sm px-2 sm:px-3 py-1 bg-slate-700/50 text-slate-400 rounded-full">
                  Mínimo: 5 pessoas
                </span>
              )}
            </div>

            <div className="space-y-2 sm:space-y-3">
              {participantes.map((p, index) => (
                <div
                  key={p.id}
                  className={`px-3 sm:px-5 py-3 sm:py-4 rounded-xl border-2 transition-all duration-300 animate-slideIn hover:scale-102 ${
                    p.id === meuId
                      ? 'bg-gradient-to-r from-primary/20 to-secondary/20 border-primary shadow-lg shadow-primary/20'
                      : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm sm:text-base text-slate-100 flex items-center gap-2 truncate">
                      <span className="text-lg sm:text-xl">👤</span>
                      <span className="truncate">{p.nome}</span>
                      {p.id === meuId && <span className="text-primary text-xs sm:text-sm whitespace-nowrap">(você)</span>}
                    </span>
                    {p.is_host && (
                      <span className="text-xs px-2 sm:px-3 py-1 bg-gradient-to-r from-primary to-secondary text-white rounded-full font-bold shadow-md whitespace-nowrap">
                        ⭐ Host
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Botão de sortear (só aparece para o host) */}
        {isHost && !sala?.sorteada && (
          <Button
            onClick={handleSortear}
            disabled={participantes.length < 5 || isSorteando}
            className="w-full text-base sm:text-lg py-3 sm:py-4"
          >
            {isSorteando
              ? '🎲 Sorteando...'
              : participantes.length < 5
              ? `🔒 Faltam ${5 - participantes.length} participantes`
              : '🎲 Realizar Sorteio'}
          </Button>
        )}

        {sala?.sorteada && !isHost && !meuAmigoSecreto && (
          <Card className="p-4 border-accent">
            <p className="text-center text-slate-300">
              ⏳ Aguardando seu resultado...
            </p>
          </Card>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
