import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/Button'
import confetti from 'canvas-confetti'

export function Home() {
  const [nome, setNome] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const navigate = useNavigate()

  const handleCreateRoom = async () => {
    if (!nome.trim()) return

    setIsCreating(true)
    
    try {
      // Gerar ID único para o host
      const hostId = crypto.randomUUID()
      
      // Criar sala
      const { data: sala, error: salaError } = await supabase
        .from('salas')
        .insert({ host_id: hostId })
        .select()
        .single()

      if (salaError) throw salaError

      // Adicionar host como participante
      const { error: participanteError } = await supabase
        .from('participantes')
        .insert({
          sala_id: sala.id,
          nome: nome.trim(),
          is_host: true
        })

      if (participanteError) throw participanteError

      // Efeito visual de sucesso
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      })

      // Redirecionar para a sala
      navigate(`/sala/${sala.id}?host=${hostId}`)
    } catch (error) {
      console.error('Erro ao criar sala:', error)
      alert('Erro ao criar sala. Tente novamente.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-float-delayed"></div>
      </div>

      <div className="max-w-md w-full space-y-8 text-center relative z-10">
        <div className="space-y-4">
          <div className="relative inline-block">
            <h1 className="text-8xl animate-bounce-slow">🎁</h1>
            <div className="absolute -top-2 -right-2 text-4xl animate-spin-slow">✨</div>
          </div>
          
          {/* Nome do app */}
          <div className="space-y-2">
            <h2 className="text-6xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent animate-gradient tracking-tight">
              Friendss
            </h2>
            <p className="text-2xl font-bold text-slate-300">
              Amigo Secreto
            </p>
          </div>
          
          <p className="text-slate-400 text-lg font-medium">
            🎉 Bem-vindo! Crie uma sala e convide seus amigos!
          </p>
        </div>

        <div className="space-y-4 bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-700 shadow-2xl">
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Digite seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
              className="w-full px-4 py-4 bg-slate-900/80 border-2 border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-100 placeholder-slate-500 transition-all duration-200 hover:border-slate-600"
              disabled={isCreating}
            />
          </div>

          <Button
            onClick={handleCreateRoom}
            disabled={!nome.trim() || isCreating}
            className="w-full text-lg py-4 shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all duration-200"
          >
            {isCreating ? '✨ Criando...' : '✨ Criar Nova Sala'}
          </Button>
        </div>

        <div className="pt-4 text-slate-500 text-sm space-y-2">
          <p className="flex items-center justify-center gap-2">
            <span className="text-lg">👥</span>
            Mínimo de 5 participantes para sortear
          </p>
          <p className="flex items-center justify-center gap-2">
            <span className="text-lg">⏰</span>
            Sala expira em 1h (5min após sorteio)
          </p>
        </div>
      </div>
    </div>
  )
}
