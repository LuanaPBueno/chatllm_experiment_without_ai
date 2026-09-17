#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Python nao encontrado. Instale Python 3.10+ e tente novamente."
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "Criando ambiente virtual em .venv"
  "$PYTHON_BIN" -m venv .venv
fi

VENV_PYTHON=".venv/bin/python"
if [ ! -x "$VENV_PYTHON" ]; then
  echo "Falha ao localizar Python do ambiente virtual em $VENV_PYTHON"
  exit 1
fi

echo "Atualizando pip no .venv"
"$VENV_PYTHON" -m pip install --upgrade pip

echo "Instalando dependencias do backend"
"$VENV_PYTHON" -m pip install -r backend/requirements.txt

if [ ! -f ".env" ]; then
  if [ ! -f "assets.dat" ]; then
    echo "Arquivo assets.dat nao encontrado na raiz do projeto."
    exit 1
  fi
  echo "Extraindo .env. Digite a senha fornecida pelo professor."
  EXTRACT_CMD=""
  if command -v unzip >/dev/null 2>&1; then
    EXTRACT_CMD="unzip -o assets.dat data.txt"
  elif command -v bsdtar >/dev/null 2>&1; then
    EXTRACT_CMD="bsdtar -xf assets.dat data.txt"
  else
    echo "Ferramenta 'unzip' nao encontrada. Instale-a (ex: sudo apt install unzip) e execute o setup novamente."
    exit 1
  fi
  if $EXTRACT_CMD && [ -s data.txt ]; then
    mv data.txt .env
    echo ".env extraido com sucesso."
  else
    rm -f data.txt
    echo "Falha ao extrair o .env. Confirme a senha com o professor e execute o setup novamente."
    exit 1
  fi
fi

if [ "${1:-}" = "run" ]; then
  exec "$VENV_PYTHON" -m uvicorn backend.main:app \
    --reload \
    --reload-dir backend \
    --reload-dir frontend \
    --reload-include '*.html' \
    --reload-include '*.js' \
    --reload-include '*.jsx' \
    --reload-include '*.css' \
    --host 127.0.0.1 \
    --port 8000
fi

echo "Setup concluido."
echo "Para ativar o ambiente: source .venv/bin/activate"
echo "Para rodar a aplicacao: bash ./setup.sh run"
echo "No VS Code, voce tambem pode abrir Executar e Depurar, selecionar 'ChatLLM API (uvicorn)' e pressionar F5."
