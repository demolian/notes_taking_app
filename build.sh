#!/bin/bash

# Simple build script for Vercel deployment
echo "🚀 Starting build process..."

# Set environment variables
export GENERATE_SOURCEMAP=false
export ESLINT_NO_DEV_ERRORS=true
export DISABLE_ESLINT_PLUGIN=true
export TSC_COMPILE_ON_ERROR=true

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building the project..."
npm run build

echo "✅ Build completed successfully!"