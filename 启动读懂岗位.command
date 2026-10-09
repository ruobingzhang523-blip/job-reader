#!/bin/zsh
cd "$(dirname "$0")" || exit 1
TASK_NODE="$(command -v node)"
if [[ -z "$TASK_NODE" && -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  TASK_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ -z "$TASK_NODE" ]]; then
  echo '请先安装Node.js 24或更新版本，然后重新打开。'
  read 'reply?按回车退出'
  exit 1
fi
exec "$TASK_NODE" start.mjs
