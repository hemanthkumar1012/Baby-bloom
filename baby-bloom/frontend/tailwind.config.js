/** @type {import('tailwindcss').Config} */
// BABY BLOOM — "colour-coded aisles". Cool milk-glass base, navy ink, one cobalt action
// colour, and a pastel swatch per category (like muslin prints and stacking blocks).
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        milk: '#F7F8FB', // page background — cool milk-glass white
        ink: '#1F2340', // text & primary buttons — deep navy
        blush: '#2F4BD8', // the one action / focus colour — bath-toy cobalt
        mist: '#EEF0F7', // quiet surfaces
        sage: '#CDEBD9',
        // category aisles
        sky: { DEFAULT: '#CFE6F5', ink: '#1D4E6E' }, // Bath & Skin
        butter: { DEFAULT: '#FBE7A1', ink: '#6B5410' }, // Diapering
        mint: { DEFAULT: '#CDEBD9', ink: '#1F5A3B' }, // Feeding
        peach: { DEFAULT: '#FAD4C0', ink: '#7A3A1C' }, // Clothing
        lilac: { DEFAULT: '#E1D7F3', ink: '#4B3477' }, // Toys
        rose: { DEFAULT: '#F6CFD9', ink: '#7C2942' }, // Mom Care
      },
      fontFamily: {
        display: ['Unbounded', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
      borderRadius: { block: '20px', arch: '999px 999px 32px 32px' },
      boxShadow: { soft: '0 1px 2px rgba(31,35,64,.06), 0 12px 32px -16px rgba(31,35,64,.18)' },
      keyframes: {
        drop: {
          '0%': { transform: 'translateY(-120%) rotate(var(--r, 0deg))', opacity: 0 },
          '60%': { transform: 'translateY(6%) rotate(var(--r, 0deg))', opacity: 1 },
          '80%': { transform: 'translateY(-2%) rotate(var(--r, 0deg))' },
          '100%': { transform: 'translateY(0) rotate(var(--r, 0deg))', opacity: 1 },
        },
        bump: { '0%,100%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.35)' } },
      },
      animation: {
        drop: 'drop .7s cubic-bezier(.3,1.4,.5,1) both',
        bump: 'bump .4s ease-out',
      },
    },
  },
  plugins: [],
};
