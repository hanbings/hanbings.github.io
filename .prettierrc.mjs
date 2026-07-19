/** @type {import('prettier').Config} */
export default {
  plugins: ['prettier-plugin-astro'],
  semi: false,
  singleQuote: true,
  bracketSpacing: false,
  printWidth: 100,
  proseWrap: 'preserve',
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
        tabWidth: 4,
      },
    },
  ],
}
