#!/bin/bash

echo "Setup replica set key"

mkdir -p /keys/
if [ ! -f "/keys/rs0" ]; then
    openssl rand -base64 756 > /keys/rs0
    chown 999:999 /keys/rs0
    chmod 400 /keys/rs0
else
    echo "The file '/keys/rs0' exists."
fi

# Wait for mongod to be ready
echo "Waiting for MongoDB to start..."
until echo 'db.runCommand("ping").ok' | mongosh \
    --host mongo \
    --port 27017 \
    -u ${MONGO_INITDB_ROOT_USERNAME} \
    -p ${MONGO_INITDB_ROOT_PASSWORD} \
    --quiet
do
  sleep 2
  echo "Still Waiting for MongoDB to start..."
done

echo 'Setup replicaset'

# sudo ifconfig lo0 alias 127.0.0.2 up
mongosh \
  --host mongo \
  --port 27017 \
  -u ${MONGO_INITDB_ROOT_USERNAME} \
  -p ${MONGO_INITDB_ROOT_PASSWORD} \
  --eval 'rs.initiate({_id: "rs0", members: [{ _id: 0, host: "mongo:27017" }]});'

until mongosh \
    --host mongo \
    --port 27017 \
    -u ${MONGO_INITDB_ROOT_USERNAME} \
    -p ${MONGO_INITDB_ROOT_PASSWORD} \
    --eval 'rs.status()'
do
    sleep 2
    echo "Waiting for replicaset"
done

echo "Done."
