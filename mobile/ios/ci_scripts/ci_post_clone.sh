#!/bin/sh
set -e

# Install Node
curl -fsSL https://fnm.vercel.app/install | bash
export PATH="$HOME/.local/share/fnm:$PATH"
eval "$(fnm env)"
fnm install 22
fnm use 22

# Install dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH/mobile"
npm install --legacy-peer-deps

# Install CocoaPods dependencies
cd ios
pod install
