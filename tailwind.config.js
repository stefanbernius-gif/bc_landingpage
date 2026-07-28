/** Rebuild:  npx tailwindcss@3 -c tailwind.config.js -i src/input.css -o assets/tailwind.min.css --minify */
module.exports = {
  content: ['./**/*.html'],
  theme: {
    extend: {
      colors: { navy: '#002349', gold: '#BC9042', 'gold-light': '#E7C874', teal: '#37C3C4' },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
};
