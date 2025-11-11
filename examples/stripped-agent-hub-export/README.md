This file contains a stripped down approximation of what we are running in production now at least from a code standpoint. I had to strip out the actual build of the docker container since that's built of multiple layers of Fastify "stuff' and at least from a tracing standpoint it's not necessary.

I did, however, leave the `run` script in here in case you are curious how the app is started inside Docker/k8s.

I've also pinned all the dependencies because the package-lock.json files we use end up having a lot of internal details. Upgrading Mastra has been a struggle for us but that's probably a separate discussion.

To see typical traces (again... this is highly stripped down) after setting up the model+authentication.

- Run make `start-depsonly` -- this runs Jaeger locally
- Run npm `start:dev` -- this will start a Fastify server on port 8080.
- Send a CURL like:
  ```
  curl --request POST \
  --url http://localhost:8080/demo/v1 \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: nonsense' \
  --data '{"message": "hello"}'
  ```

Look at the Jaeger UI on http://localhost:16686/
There's a subset of the Mastra API exposed as well so you can do things like curl http://localhost:8080/api/agents/ or whatever.
