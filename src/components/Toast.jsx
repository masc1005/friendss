import { useEffect, useState } from 'react'

export function Toast({ message, onClose, duration = 3000 }) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Aguarda animação antes de remover
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div
      className={`fixed top-4 right-4 bg-slate-800 border border-slate-700 rounded-lg px-6 py-4 shadow-xl transition-all duration-300 z-50 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <p className="text-slate-100">{message}</p>
    </div>
  )
}
