module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Disable problematic rules for production builds
    'import/first': 'off',
    'import/order': 'off',
    'no-unused-vars': 'off',
    'no-console': 'off',
    'react/no-danger': 'off',
    'react-hooks/exhaustive-deps': 'off'
  },
  overrides: [
    {
      files: ['src/**/*.js', 'src/**/*.jsx'],
      rules: {
        // Disable all problematic rules for source files
        'import/first': 'off',
        'import/order': 'off',
        'no-unused-vars': 'off',
        'no-console': 'off'
      }
    }
  ]
};