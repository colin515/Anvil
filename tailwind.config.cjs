module.exports = {
  content: ['./index.html', './src/**/*.{tsx,ts}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)', surface: 'var(--surface)', elevated: 'var(--elevated)',
        text: 'var(--text)', muted: 'var(--muted)', heat: 'var(--heat)',
        cyan: 'var(--cyan)', line: 'var(--line)', success: 'var(--success)'
      },
      fontFamily: { sans: ['Segoe UI Variable', 'Inter', 'system-ui', 'sans-serif'], mono: ['Cascadia Code','monospace'] },
      borderRadius: { panel: '18px' }
    }
  },
  plugins: []
}
