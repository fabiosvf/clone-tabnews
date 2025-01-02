import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

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
    "next/core-web-vitals",
    "prettier",
  ),
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
