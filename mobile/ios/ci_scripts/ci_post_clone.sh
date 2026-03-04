#!/bin/sh
set -e

# Install Node via homebrew (available on Xcode Cloud)
brew install node@22 || true
export PATH="/usr/local/opt/node@22/bin:$PATH"

# Install dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH/mobile"
npm install --legacy-peer-deps

# Run expo prebuild to generate ios/ native project
npx expo prebuild --platform ios --no-install

# Install CocoaPods dependencies
cd ios
pod install
