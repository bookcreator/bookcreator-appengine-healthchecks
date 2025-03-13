const js = require('@eslint/js')
const node = require('eslint-plugin-n')
const mocha = require('eslint-plugin-mocha')

module.exports = [
   js.configs.recommended,
   node.configs['flat/recommended'],
   {
      name: 'Source',
      languageOptions: {
         ecmaVersion: 2020,
         sourceType: 'commonjs',
         parserOptions: {
            ecmaFeatures: {
               impliedStrict: true
            }
         },
      },
      'rules': {
         'eqeqeq': 'error',
         'n/global-require': 'error',
         'n/handle-callback-err': 'error',
         'no-console': 'error',
         'no-loop-func': 'error',
         'no-multi-spaces': 'warn',
         'no-trailing-spaces': [
            'error',
            {
               skipBlankLines: true
            }
         ],
         'no-unused-vars': [
            'warn',
            {
               argsIgnorePattern: '^_',
               varsIgnorePattern: '^_',
               caughtErrorsIgnorePattern: '^_'
            }
         ],
         'quotes': [
            'error',
            'single',
            {
               allowTemplateLiterals: true
            }
         ],
         'semi': [
            'error',
            'never'
         ],
         'spaced-comment': [
            'error',
            'always',
            {
               markers: [
                  '/'
               ],
               exceptions: [
                  '*'
               ],
               block: {
                  balanced: true
               }
            }
         ],
      }
   },
   {
      ...mocha.configs.flat.recommended,
      name: 'Tests',
      files: [
         'test/**',
      ],
      rules: {
         'n/global-require': 'off',
         'n/no-extraneous-require': ['error', {
            allowModules: [
               '@google-cloud/precise-date'
            ]
         }]
      }
   }
]