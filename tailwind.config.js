/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#FED71A',
        'silver-grain': '#D1D1D1',
        'error-red': '#C0392B',
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        glass: '24px',
        'glass-lg': '32px',
      },
      backdropBlur: {
        glass: '24px',
      },
    },
  },
  plugins: [],
}
