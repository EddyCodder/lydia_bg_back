#!/bin/bash
set -e

# Crea la base de datos de Evolution API si no existe. Desde CRM-11 ya no
# hace falta 'chatwoot_production' (Chatwoot salio del stack); la base
# vieja, si quedo creada de un despliegue anterior, no se borra sola --
# limpiarla a mano en el VPS es seguro una vez confirmado que nada la usa.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE evolution'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution')\gexec
EOSQL

echo ">>> [PostgreSQL Init] Base de datos 'evolution' verificada/creada con exito."
