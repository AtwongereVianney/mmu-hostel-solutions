import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                fetch: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                FormData: 'readonly',
                Event: 'readonly',
                CustomEvent: 'readonly',
                HTMLElement: 'readonly',
                HTMLInputElement: 'readonly',
                HTMLButtonElement: 'readonly',
                HTMLDivElement: 'readonly',
                HTMLFormElement: 'readonly',
                HTMLSelectElement: 'readonly',
                HTMLOptionElement: 'readonly',
                NodeList: 'readonly',
                DOMParser: 'readonly',
                // Browser APIs
                crypto: 'readonly',
                FileReader: 'readonly',
                DataTransfer: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                navigator: 'readonly',
                screen: 'readonly',
                btoa: 'readonly',
                atob: 'readonly',
                // App globals
                App: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off',
            'prefer-const': 'error',
            'no-var': 'error',
            'no-empty': 'warn',
            'no-control-regex': 'warn',
            'no-useless-escape': 'warn'
        }
    },
    {
        files: ['js/security.js'],
        rules: {
            'no-empty': 'off',
            'no-control-regex': 'off',
            'no-useless-escape': 'off'
        }
    }
];