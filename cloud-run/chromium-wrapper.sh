#!/bin/sh
# Chromium wrapper script to disable crash reporter
exec /usr/bin/chromium \
  --disable-crash-reporter \
  --disable-dev-shm-usage \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-extensions \
  "$@"