module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // Disable import/first rule for better organization
    'import/first': 'off',
    // More lenient unused variables rule
    'no-unused-vars': ['warn', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_',
      'ignoreRestSiblings': true
    }],
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
        'import/order': 'off',
        'no-unused-vars': 'warn'
      }
    },
    {
      // Even more lenient for build process
      files: ['src/App.js'],
      rules: {
        'no-unused-vars': 'off'
      }
    }
  ]
};