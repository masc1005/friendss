export function Card({ children, className = '' }) {
  return (
    <div className={`bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 ${className}`}>
      {children}
    </div>
  )
}
