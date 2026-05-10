/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}', './frontend/index.html', './frontend/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif']
      },
      colors: {
        ink: '#07110d',
        panel: '#0c1c15',
        panel2: '#10281f',
        line: '#1e3b30',
        mint: '#45e5a7',
        mintSoft: '#9ff4d2',
        danger: '#ff6b6b'
      },
      boxShadow: {
        glow: '0 0 40px rgba(69, 229, 167, 0.15)'
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        pulseDot: {
          '0%, 100%': { opacity: '0.35', transform: 'translateY(0)' },
          '50%': { opacity: '1', transform: 'translateY(-2px)' }
        }
      },
      animation: {
        rise: 'rise 180ms ease-out',
        pulseDot: 'pulseDot 900ms ease-in-out infinite'
      }
    }
  },
  plugins: []
};
