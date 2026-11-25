#!/bin/sh
set -eu

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"
chmod +x .githooks/pre-commit .githooks/pre-merge-commit
git config --local core.hooksPath .githooks
printf 'Version hooks installed for this repository.\n'