# docker build -t restofrigo-server -f Dockerfile .
# docker run -it --rm --name restofrigo-server -p 9992:9992 --env-file .env.docker restofrigo-server:latest
FROM denoland/deno:alpine-2.4.0

WORKDIR /application

# Environment Variables
ENV NODE_ENV=production
ENV OTEL_DENO=true

# CORE Component
COPY ./deno.json /application/deno.json
COPY ./deno.lock /application/deno.lock

# APP Specific
COPY . /application/

RUN deno cache /application/src/mod.ts

EXPOSE 9992

CMD ["deno", "run", "--unstable-otel", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--allow-sys", "/application/src/mod.ts"]
