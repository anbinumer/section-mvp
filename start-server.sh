#!/bin/bash

echo "Starting Canvas Section Manager..."
echo "Current directory: $(pwd)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo "Installing dependencies..."
npm install

echo "Starting server..."
node server.js 