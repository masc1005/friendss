/**
 * Algoritmo de sorteio de amigo secreto
 * Garante que ninguém tire a si mesmo
 */
export function realizarSorteio(participantes) {
  if (participantes.length < 5) {
    throw new Error('Mínimo de 5 participantes necessário')
  }

  const nomes = participantes.map(p => p.nome)
  const shuffled = [...nomes]
  
  // Fisher-Yates shuffle até encontrar uma permutação válida
  let valido = false
  let tentativas = 0
  const maxTentativas = 100

  while (!valido && tentativas < maxTentativas) {
    // Embaralhar
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Verificar se ninguém tirou a si mesmo
    valido = nomes.every((nome, idx) => nome !== shuffled[idx])
    tentativas++
  }

  if (!valido) {
    throw new Error('Não foi possível realizar o sorteio')
  }

  // Criar mapeamento: cada participante -> seu amigo secreto
  return participantes.map((p, idx) => ({
    id: p.id,
    amigo_secreto: shuffled[idx]
  }))
}
