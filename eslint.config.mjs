import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const config = [
  ...compat.extends(
    "eslint:recommended",
    "plugin:jest/recommended",
    "prettier",
  ),
  {
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactPlugin.configs.recommended.rules,
    },
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        React: "readonly",
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        afterAll: "readonly",
        afterEach: "readonly",
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: [
      "commitlint.config.js",
      "jest.config.js",
      "infra/scripts/**/*.js",
      "infra/migrations/**/*.js",
    ],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
      },
    },
  },
  {
    ignores: [
      ".next/**",
      "dist/**",
      "build/**",
      "node_modules/**",
      ".swc/**",
      ".github/**",
      ".husky/**",
    ],
  },
];

export default config;
