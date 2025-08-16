module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Disable import/first rule for better organization
    'import/first': 'off',
    // Allow unused variables that start with underscore
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    // Disable console warnings in development
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    // Allow dangerouslySetInnerHTML for rich text content
    'react/no-danger': 'off'
  },
  overrides: [
    {
      files: ['src/**/*.js', 'src/**/*.jsx'],
      rules: {
        // More lenient rules for source files
        'import/first': 'off',
        'import/order': 'off'
      }
    }
  ]
};