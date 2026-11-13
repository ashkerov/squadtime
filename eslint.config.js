import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const noDirectStorage = {
  'no-restricted-globals': [
    'error',
    { name: 'localStorage', message: 'Только через MeetingRepository (src/storage).' },
    { name: 'sessionStorage', message: 'Только через MeetingRepository (src/storage).' },
  ],
  'no-restricted-properties': [
    'error',
    { object: 'window', property: 'localStorage', message: 'Только через MeetingRepository.' },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Критерий приёмки: в pages/ и components/ нет прямых обращений к localStorage.
    files: ['src/pages/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/domain/**/*.ts'],
    rules: noDirectStorage,
  },
);
