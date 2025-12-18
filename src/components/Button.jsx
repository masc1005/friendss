export function Button({ children, onClick, disabled, variant = 'primary', className = '' }) {
  const baseStyles = 'px-6 py-3 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95'
  
  const variants = {
    primary: 'bg-gradient-to-r from-primary via-secondary to-primary bg-size-200 hover:bg-pos-100 hover:shadow-2xl hover:shadow-primary/50 text-white border border-primary/30',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-2 border-slate-700 hover:border-slate-600 hover:shadow-lg',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
