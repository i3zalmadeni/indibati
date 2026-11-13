#!/usr/bin/env bash
# يشغّل اختبارات قاعدة البيانات على Postgres محلي (لا يتصل بأي قاعدة حقيقية).
# الاستخدام: PGHOST=/tmp/pg PGPORT=5544 tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q -t -o /dev/null"
$P -d postgres -c "drop database if exists indibati_test" -c "create database indibati_test"
$P -d indibati_test -f tests/core_stub.sql
for f in supabase/migrations/*.sql; do $P -d indibati_test -f "$f"; $P -d indibati_test -f "$f"; done  # مرتين: التحقق من قابلية إعادة التنفيذ
for t in tests/0*_test.sql; do $P -d indibati_test -f "$t"; done
