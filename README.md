# Rest-O-Frigo Backend

# Steps (Setup Using Docker)

1. Create the `.env.docker`

```dotenv
OPENAI_API_KEY=YOUR_OPENAI_KEY
MONGO_DB_URL=mongodb://127.0.0.1:27018
MONGO_DB_NAME=restofrigo
```

2. Update the `docker-compose.yml` to fit your configuration
3. Start the application, `docker compose up -d`
4. Setup the Database, `cd prompt; deno task setup`
5. Create an API Key, `cd prompt; deno task create --email=tommy@studiowebux.com --tokens=10`
6. Test endpoints

- **Generate a recipe**: `http POST localhost:9992/ Authorization:YOUR_API_KEY --raw '{
  "threadId": "session123",
  "prompt": "Homemade vanilla ice cream recipe",
  "revision": 0
}'`
- **Current usage**: `http GET localhost:9992/usage Authorization:YOUR_API_KEY`

7. Update the mobile app `endpoint` and `token` to fit your configuration.
