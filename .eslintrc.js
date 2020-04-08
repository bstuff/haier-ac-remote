const path = require('path');

module.exports = {
  extends: [
    "xo",
    "plugin:prettier/recommended",
  ],
  plugins: [
    "@typescript-eslint/eslint-plugin",
    "import",
  ],
  parser: "babel-eslint",
  parserOptions: {
      "ecmaVersion": 2020,
      "sourceType": "module"
  },
  env: {
    browser: false,
    node: true,
  },
  rules: {
    'no-console': 'off',
    // CodeStyle
    "one-var": "error",
    "camelcase": "off",
    "dot-notation": "error",
    "padded-blocks": "off",
    "spaced-comment": "off",
    "no-inline-comments": "off",
    "max-nested-callbacks": "off",
    "newline-before-return": "warn",
    //Complexity
    "max-depth": [
        "error",
        4
    ],
    "max-params": [
        "error",
        5
    ],
    //Practices
    "no-empty": "error",
    "no-console": "error",
    "no-eq-null": "error",
    "no-await-in-loop": "off",
    "eqeqeq": [
        "error",
        "allow-null"
    ],
    "wrap-iife": [
        "error",
        "any"
    ],
    "no-implicit-coercion": [
        "error",
        {
            "number": false,
            "boolean": false
        }
    ],
    "no-unused-expressions": [
        "error",
        {
            "allowShortCircuit": true,
            "allowTernary": true
        }
    ],
    "no-use-before-define": [
        "error",
        {
            "functions": false
        }
    ],
    "capitalized-comments": "off",
    "no-multi-assign": "off",
    "valid-jsdoc": [
        "error",
        {
            "prefer": {
                "return": "returns"
            },
            "preferType": {
                "string": "String",
                "object": "Object",
                "number": "Number",
                "boolean": "Boolean"
            },
            "requireReturn": false,
            "requireParamDescription": false,
            "requireReturnDescription": false
        }
    ],
    "no-warning-comments": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "import/no-default-export": "error",
    "import/order": [
        "warn",
        {
            "groups": [
                [
                    "builtin",
                    "external",
                    "internal"
                ],
                "parent",
                "sibling",
                "index"
            ],
            "newlines-between": "always",
            "alphabetize": {
                "order": "asc",
                "caseInsensitive": true
            }
        }
    ],
  },
  overrides: [
    {
      files: ['**/*.ts?(x)'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        project: path.resolve(__dirname, 'tsconfig.json'),

        // typescript-eslint specific options
        warnOnUnsupportedTypeScriptVersion: true,
      },
      plugins: ['@typescript-eslint'],
      // If adding a typescript-eslint version of an existing ESLint rule,
      // make sure to disable the ESLint rule here.
      rules: {
        // TypeScript's `noFallthroughCasesInSwitch` option is more robust (#6906)
        'default-case': 'off',
        // 'tsc' already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/291)
        'no-dupe-class-members': 'off',
        // 'tsc' already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/477)
        'no-undef': 'off',

        // Add TypeScript specific rules (and turn off ESLint equivalents)
        '@typescript-eslint/consistent-type-assertions': 'warn',
        'no-array-constructor': 'off',
        '@typescript-eslint/no-array-constructor': 'warn',
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': [
          'warn',
          {
            functions: false,
            classes: false,
            variables: false,
            typedefs: false,
          },
        ],
        'no-unused-expressions': 'off',
        '@typescript-eslint/no-unused-expressions': [
          'error',
          {
            allowShortCircuit: true,
            allowTernary: true,
            allowTaggedTemplates: true,
          },
        ],
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            args: 'none',
            ignoreRestSiblings: true,
          },
        ],
        'no-useless-constructor': 'off',
        '@typescript-eslint/no-useless-constructor': 'warn',
      },
    },
  ],
};
