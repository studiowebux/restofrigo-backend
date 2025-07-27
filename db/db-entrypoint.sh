#!/bin/bash
echo 'Creating application users and databases'

mongosh ${DB_NAME} \
  --host localhost \
  --port 27017 \
  -u ${MONGO_INITDB_ROOT_USERNAME} \
  -p ${MONGO_INITDB_ROOT_PASSWORD} \
  --authenticationDatabase admin \
  --eval "db.createUser({user: '${DB_ADMIN}', pwd: '${DB_ADMIN_PASSWORD}', roles:[{role:'dbOwner', db: '${DB_NAME}'}]});"

mongosh ${DB_NAME} \
--host localhost \
--port 27017 \
-u ${MONGO_INITDB_ROOT_USERNAME} \
-p ${MONGO_INITDB_ROOT_PASSWORD} \
--authenticationDatabase admin \
--eval "db.createUser({user: '${DB_USER}', pwd: '${DB_PASSWORD}', roles:[{role:'readWrite', db: '${DB_NAME}'}]});"
