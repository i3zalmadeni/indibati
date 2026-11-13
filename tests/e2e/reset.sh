#!/usr/bin/env bash
# يعيد بناء قاعدة المعاينة المحلية ويشغّل خادمها (بيانات وهمية فقط)
set -euo pipefail; cd "$(dirname "$0")/../.."
P="psql -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null"
$P -d postgres -c "drop database if exists indibati_e2e" -c "create database indibati_e2e" 2>/dev/null
$P -d indibati_e2e -f tests/core_stub.sql
for f in supabase/migrations/*.sql; do $P -d indibati_e2e -f "$f" 2>/dev/null; done
$P -d indibati_e2e -f tests/e2e/seed.sql
pkill -f e2e/server.js || true
(PGDATABASE=indibati_e2e node tests/e2e/server.js > /tmp/srv.log 2>&1 &); sleep 1.5
