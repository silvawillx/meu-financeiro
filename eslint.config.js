import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Só pega o que mais machuca: nome usado sem existir (no-undef).
export default [
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: { "react-hooks/exhaustive-deps": "off", "no-undef": "error", "react/jsx-uses-vars": "error", "react/jsx-no-undef": "error", "react/jsx-uses-react": "error" },
  },
];
